const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Relationship = require('../models/Relationship'); // Make sure Relationship model is imported
const jwt = require('jsonwebtoken');
// bcryptjs is implicitly used by the User model's pre-save hook and comparePassword method.
// No need to call bcrypt directly in routes if logic is handled in the model.

/**
 * @helper
 * @desc Gets the inverse of a given relationship type.
 * @param {String} type - The relationship type (e.g., 'Parent').
 * @returns {String} The inverse relationship type (e.g., 'Child').
 */
const getInverseRelationshipType = (type) => {
  const map = {
    'Parent': 'Child',
    'Child': 'Parent',
    'Sibling': 'Sibling',
    'Spouse': 'Spouse',
    'Cousin': 'Cousin',
    'Aunt/Uncle': 'Niece/Nephew',
    'Niece/Nephew': 'Aunt/Uncle',
    'Grandparent': 'Grandchild',
    'Grandchild': 'Grandparent',
    'Friend': 'Friend',
    'Other': 'Other',
  };
  return map[type] || type; // Fallback to the original type
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user.
 *          Validates input, checks for existing users by email or phone,
 *          hashes the password (via User model middleware), saves the new user,
 *          and returns a JWT token.
 * @access  Public
 * @param   {object} req.body - Should contain name, birthYear, email, password, and optionally phone.
 * @returns {object} JSON object containing the JWT token if registration is successful.
 *                   Otherwise, returns an error message.
 */
router.post('/register', async (req, res) => {
  // Destructure required fields from request body, including new invite-related fields
  const { name, birthYear, email, phone, password, inviteCode, relationshipToInviter } = req.body;

  // Basic validation for required fields
  if (!name || !birthYear || !email || !password) {
    return res.status(400).json({ msg: 'Please provide name, birthYear, email, and password.' });
  }

  try {
    // --- Start: Invite Code Validation (BEFORE creating the new user) ---
    let invitingUser = null;
    if (inviteCode) {
      if (!relationshipToInviter) {
        return res.status(400).json({ msg: 'Relationship to inviter is required when using an invite code.' });
      }
      invitingUser = await User.findOne({ inviteCode });
      if (!invitingUser) {
        return res.status(400).json({ msg: 'Invalid invite code provided.' });
      }
      // Prevent self-invitation or registering as the inviter
      if (invitingUser.email === email.toLowerCase() || (phone && invitingUser.phone && invitingUser.phone === phone)) {
          return res.status(400).json({ msg: 'Cannot use an invite code to register as the same person who invited you.' });
      }
    }
    // --- End: Invite Code Validation ---

    // Check if a user already exists with the provided email
    let existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists with this email.' });
    }

    // If phone is provided, check if a user already exists with this phone number
    if (phone) {
      existingUser = await User.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({ msg: 'User already exists with this phone number.' });
      }
    }

    // Create a new user instance. Password hashing is handled by the User model's pre-save hook.
    // The new user does not store the inviteCode they used; it's only for finding the inviter.
    const newUser = new User({
      name,
      birthYear,
      email: email.toLowerCase(), // Store email in lowercase for consistency
      phone, // Optional
      password,
    });

    // Save the new user to the database
    await newUser.save();

    // --- Start: Automatic Relationship Creation (AFTER new user is saved) ---
    if (invitingUser) {
      try {
        // Relationship 1: New User -> Inviting User
        // (e.g., New User is "Child" of Inviting User, if relationshipToInviter is "Child")
        const relationship1 = new Relationship({
          user1: newUser.id, // The new user
          user2: invitingUser.id,
          relationshipType: relationshipToInviter,
        });
        await relationship1.save();

        // Relationship 2: Inviting User -> New User (Inverse)
        // (e.g., Inviting User is "Parent" of New User, if relationshipToInviter was "Child")
        const inverseType = getInverseRelationshipType(relationshipToInviter);
        const relationship2 = new Relationship({
          user1: invitingUser.id,
          user2: newUser.id, // The new user
          relationshipType: inverseType,
        });
        await relationship2.save();

        console.log(`Automatic relationships created via invite between ${newUser.email} and ${invitingUser.email}.`);

      } catch (relError) {
        // If relationship creation fails, the user is already registered.
        // This is a partial failure. Log it. Decide if you want to inform the user.
        console.error(`Failed to create automatic relationships for invited user ${newUser.email} (inviter: ${invitingUser.email}): ${relError.message}`);
        // Optionally, you could add a specific message to the JWT response or a separate field.
        // For now, the registration itself is successful, and token is returned.
        // The frontend could display a generic "Registration successful, check dashboard for connections."
      }
    }
    // --- End: Automatic Relationship Creation ---

    // Prepare JWT payload
    const payload = {
      user: {
        id: newUser.id, // User ID from the newly saved user
      },
    };

    // Sign the JWT token
    jwt.sign(
      payload,
      process.env.JWT_SECRET, // Secret key from environment variables
      { expiresIn: 360000 }, // Token expiration time (e.g., 100 hours)
      (err, token) => {
        if (err) throw err; // If signing fails, throw error to be caught by catch block
        res.json({ token }); // Send the token to the client
      }
    );
  } catch (err) {
    console.error('Registration error:', err.message);
    // Handle specific Mongoose validation errors if necessary, or other errors
    if (err.name === 'ValidationError') {
        // Collect validation messages
        const messages = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({ msg: 'Validation error', errors: messages });
    }
    res.status(500).json({ msg: 'Server error during registration.' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate an existing user and get a JWT token.
 *          Validates credentials, compares password, and returns a JWT token if successful.
 * @access  Public
 * @param   {object} req.body - Should contain email and password.
 * @returns {object} JSON object containing the JWT token if login is successful.
 *                   Otherwise, returns an error message.
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation for required fields
  if (!email || !password) {
    return res.status(400).json({ msg: 'Please provide both email and password.' });
  }

  try {
    // Find user by email. '.select("+password")' ensures the password field is retrieved,
    // as it's set to 'select: false' in the User model by default.
    let user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      // User not found with that email
      return res.status(400).json({ msg: 'Invalid credentials. User not found.' });
    }

    // Compare provided password with the hashed password stored in the database
    // The 'comparePassword' method is defined in the User model
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Password does not match
      return res.status(400).json({ msg: 'Invalid credentials. Password incorrect.' });
    }

    // Prepare JWT payload
    const payload = {
      user: {
        id: user.id,
      },
    };

    // Sign the JWT token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 360000 }, // Token expiration
      (err, token) => {
        if (err) throw err;
        res.json({ token }); // Send token to client
      }
    );
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ msg: 'Server error during login.' });
  }
});

module.exports = router;

/*
=============================================================================
CONCEPTUAL API TESTS (Jest / Supertest Style)
=============================================================================

// const request = require('supertest');
// const app = require('../server'); // Assuming server.js exports the app
// const mongoose = require('mongoose');
// const User = require('../models/User');

// beforeAll(async () => { /* Connect to test DB, clear collections */ });
// afterAll(async () => { /* Disconnect from DB */ });
// beforeEach(async () => { /* Clear User collection before each test */ });

describe('Auth API: /api/auth', () => {
  describe('POST /register', () => {
    it('should register a new user successfully with all valid fields', async () => {
      // const res = await request(app)
      //   .post('/api/auth/register')
      //   .send({ name: 'Test User', birthYear: 1990, email: 'test@example.com', phone: '1234567890', password: 'password123' });
      // expect(res.statusCode).toEqual(200); // or 201
      // expect(res.body).toHaveProperty('token');
      // const user = await User.findOne({ email: 'test@example.com' });
      // expect(user).not.toBeNull();
      // expect(user.name).toBe('Test User');
      // const isPasswordMatch = await bcrypt.compare('password123', user.password); // user.password is selected in test
      // expect(isPasswordMatch).toBe(true); // This check requires selecting password field or using instance method
    });

    it('should register a new user successfully without optional phone field', async () => {
      // const res = await request(app)
      //   .post('/api/auth/register')
      //   .send({ name: 'Test User NoPhone', birthYear: 1991, email: 'testnophone@example.com', password: 'password123' });
      // expect(res.statusCode).toEqual(200);
      // expect(res.body).toHaveProperty('token');
    });

    it('should fail if email is missing', async () => {
      // const res = await request(app)
      //   .post('/api/auth/register')
      //   .send({ name: 'Test User', birthYear: 1990, password: 'password123' });
      // expect(res.statusCode).toEqual(400);
      // expect(res.body.msg).toEqual('Please provide name, birthYear, email, and password.'); // Or the specific message from your validator
    });

    it('should fail if password is too short (less than 6 characters)', async () => {
      // const res = await request(app)
      //   .post('/api/auth/register')
      //   .send({ name: 'Test User', birthYear: 1990, email: 'shortpass@example.com', password: '123' });
      // expect(res.statusCode).toEqual(400);
      // expect(res.body.errors[0]).toContain('Password must be at least 6 characters long'); // Assuming Mongoose validation error
    });

    it('should fail if email already exists', async () => {
      // await new User({ name: 'Existing User', birthYear: 1980, email: 'existing@example.com', password: 'password123' }).save();
      // const res = await request(app)
      //   .post('/api/auth/register')
      //   .send({ name: 'New User', birthYear: 1992, email: 'existing@example.com', password: 'password456' });
      // expect(res.statusCode).toEqual(400);
      // expect(res.body.msg).toEqual('User already exists with this email.');
    });

    it('should fail if phone already exists', async () => {
      // await new User({ name: 'Existing User Phone', birthYear: 1981, email: 'existingphone@example.com', phone: '0987654321', password: 'password123' }).save();
      // const res = await request(app)
      //   .post('/api/auth/register')
      //   .send({ name: 'New User Phone', birthYear: 1993, email: 'newuserphone@example.com', phone: '0987654321', password: 'password456' });
      // expect(res.statusCode).toEqual(400);
      // expect(res.body.msg).toEqual('User already exists with this phone number.');
    });
  });

  describe('POST /login', () => {
    // beforeAll(async () => {
    //   const user = new User({ name: 'Login User', email: 'login@example.com', password: 'password123', birthYear: 1985 });
    //   await user.save(); // Password will be hashed by pre-save hook
    // });

    it('should login an existing user with correct credentials', async () => {
      // const res = await request(app)
      //   .post('/api/auth/login')
      //   .send({ email: 'login@example.com', password: 'password123' });
      // expect(res.statusCode).toEqual(200);
      // expect(res.body).toHaveProperty('token');
    });

    it('should fail to login with incorrect password', async () => {
      // const res = await request(app)
      //   .post('/api/auth/login')
      //   .send({ email: 'login@example.com', password: 'wrongpassword' });
      // expect(res.statusCode).toEqual(400);
      // expect(res.body.msg).toEqual('Invalid credentials. Password incorrect.');
    });

    it('should fail to login if user does not exist', async () => {
      // const res = await request(app)
      //   .post('/api/auth/login')
      //   .send({ email: 'nonexistent@example.com', password: 'password123' });
      // expect(res.statusCode).toEqual(400);
      // expect(res.body.msg).toEqual('Invalid credentials. User not found.');
    });

    it('should fail if email is missing on login', async () => {
      // const res = await request(app)
      //   .post('/api/auth/login')
      //   .send({ password: 'password123' });
      // expect(res.statusCode).toEqual(400);
      // expect(res.body.msg).toEqual('Please provide both email and password.');
    });
  });
});
*/
