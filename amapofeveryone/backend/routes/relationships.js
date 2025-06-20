const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const Relationship = require('../models/Relationship');
const mongoose = require('mongoose'); // Used for ObjectId validation or casting if needed

/**
 * @route   POST /api/relationships/add
 * @desc    Add a relative for the authenticated user and establish a relationship.
 *          If the relative (target user) doesn't exist based on email/phone,
 *          a new User profile can be created for them.
 *          The relationship is created from the authenticated user (user1) to the target user (user2).
 * @access  Private (requires authentication via authMiddleware)
 * @param   {object} req.user - Attached by authMiddleware, contains the authenticated user's ID (req.user.id).
 * @param   {object} req.body - Contains details of the relative and relationship:
 *          - relativeName (String, required): Name of the relative.
 *          - relativeBirthYear (Number, required): Birth year of the relative.
 *          - relationshipType (String, required): Type of relationship from auth user to relative (e.g., "Child", "Parent").
 *          - relativeEmail (String, optional): Email of the relative. Used to find existing user or create new.
 *          - relativePhone (String, optional): Phone of the relative. Used to find existing user or create new if email not provided.
 * @returns {object} JSON response with a success message, the created relationship, and relative's info.
 *                   Or an error message if validation fails or an issue occurs.
 */
router.post('/add', authMiddleware, async (req, res) => {
  const { relativeName, relativeBirthYear, relativeEmail, relativePhone, relationshipType } = req.body;
  const currentUserId = req.user.id; // ID of the authenticated user

  // Validate required fields for the new relative and relationship
  if (!relationshipType || !relativeName || !relativeBirthYear) {
    return res.status(400).json({ msg: 'Please provide relationship type, relative name, and birth year.' });
  }
  if (isNaN(parseInt(relativeBirthYear))) {
    return res.status(400).json({ msg: 'Birth year must be a valid number.' });
  }

  try {
    // Fetch the current user's details (e.g., email) to prevent adding self.
    const currentUser = await User.findById(currentUserId).select('email');
    if (!currentUser) {
      // This should not happen if authMiddleware is working correctly and user hasn't been deleted mid-session.
      return res.status(401).json({ msg: 'Authenticated user not found. Authorization denied.' });
    }

    // Prevent user from adding themselves as a relative by email.
    if (relativeEmail && relativeEmail.toLowerCase() === currentUser.email) {
      return res.status(400).json({ msg: 'Cannot add yourself as a relative using your own email.' });
    }
    // Note: A similar check for phone might be needed if phone numbers are unique identifiers for login.

    let relativeUser; // This will hold the User document for the relative

    // Attempt to find the relative if email or phone is provided
    if (relativeEmail) {
      relativeUser = await User.findOne({ email: relativeEmail.toLowerCase() });
    } else if (relativePhone) {
      // Only search by phone if email was not provided or if it's a secondary lookup.
      relativeUser = await User.findOne({ phone });
    }

    // If the relative does not exist, create a new User profile for them.
    if (!relativeUser) {
      // At least one contact detail (email or phone) should be provided if creating a new user.
      // Or, if project allows creating profiles with only name/birthYear, this check can be removed.
      if (!relativeEmail && !relativePhone) {
        return res.status(400).json({ msg: 'Relative email or phone is required to find or create a new profile for them.' });
      }

      // Check for uniqueness again before creating, in case of race conditions or if only one identifier was used initially.
      if (relativeEmail) {
        const existingByEmail = await User.findOne({ email: relativeEmail.toLowerCase() });
        if (existingByEmail) return res.status(400).json({ msg: 'User already exists with this email. Please try adding them by searching or ensure details are correct.'});
      }
      if (relativePhone) {
        const existingByPhone = await User.findOne({ phone: relativePhone });
        if (existingByPhone) return res.status(400).json({ msg: 'User already exists with this phone number. Please try adding them by searching or ensure details are correct.'});
      }

      // Create the new user profile for the relative.
      // Password is not set; this user would need to claim their account or be invited.
      relativeUser = new User({
        name: relativeName,
        birthYear: parseInt(relativeBirthYear),
        email: relativeEmail ? relativeEmail.toLowerCase() : undefined, // Store email in lowercase
        phone: relativePhone || undefined,
        // No password set means they can't log in directly until an account claim process.
      });
      await relativeUser.save();
    }

    const relativeUserId = relativeUser.id;

    // Prevent user from establishing a relationship with themselves (e.g. if found via different email/phone but is same person)
    if (currentUserId === relativeUserId) {
      return res.status(400).json({ msg: 'Cannot establish a relationship with yourself.' });
    }

    // Check if this specific relationship (user1 -> user2 with relationshipType) already exists.
    const existingRelationship = await Relationship.findOne({
      user1: currentUserId,
      user2: relativeUserId,
      relationshipType: relationshipType,
    });

    if (existingRelationship) {
      return res.status(400).json({ msg: 'This exact relationship already exists.' });
    }

    // Create the new relationship document
    const newRelationship = new Relationship({
      user1: currentUserId,       // The authenticated user
      user2: relativeUserId,      // The relative (found or created)
      relationshipType: relationshipType, // How user1 views user2
    });
    await newRelationship.save();

    // Respond with success message, the new relationship, and some details of the relative.
    res.json({
      msg: 'Relative added and relationship established successfully.',
      relationship: newRelationship,
      relative: { // Return non-sensitive info about the relative
        id: relativeUser.id,
        name: relativeUser.name,
        email: relativeUser.email,
        birthYear: relativeUser.birthYear,
      },
    });

  } catch (err) {
    console.error('Add relationship error:', err.message);
    if (err.code === 11000) { // MongoDB duplicate key error
      // This can happen if User model's unique index for email/phone is violated during .save(),
      // or Relationship model's unique index is violated.
      let field = 'value';
      if (err.keyPattern) {
        field = Object.keys(err.keyPattern).join(', ');
      }
      return res.status(400).json({ msg: `A user or relationship with the provided unique field (${field}) already exists.` });
    }
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({ msg: 'Validation error while adding relative.', errors: messages });
    }
    res.status(500).json({ msg: 'Server error while adding relationship.' });
  }
});

/**
 * @route   GET /api/relationships/myfamily
 * @desc    Get all relationships for the currently authenticated user.
 *          This includes relationships where the user is user1 OR user2.
 *          Populates user details for both users in the relationship.
 * @access  Private (requires authentication)
 * @param   {object} req.user - Attached by authMiddleware, contains authenticated user's ID.
 * @returns {object} JSON array of relationship documents, or error message.
 */
router.get('/myfamily', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id); // Convert string ID to Mongoose ObjectId for querying

    // Find relationships where the current user is either user1 (the initiator/source)
    // or user2 (the target of the relationship).
    const relationships = await Relationship.find({
      $or: [{ user1: userId }, { user2: userId }],
    })
    .populate('user1', ['name', 'email', 'birthYear', 'phone']) // Select fields to populate for user1
    .populate('user2', ['name', 'email', 'birthYear', 'phone']); // Select fields to populate for user2

    if (!relationships) {
      // This case might not be strictly necessary as find() returns an empty array if no documents match.
      return res.status(404).json({ msg: 'No relationships found for this user.' });
    }

    res.json(relationships);
  } catch (err) {
    console.error('Get myfamily error:', err.message);
    res.status(500).json({ msg: 'Server error while fetching family relationships.' });
  }
});

// Conceptual helper function for inverse relationships (not currently used in routes)
// function getInverseRelationshipType(type) {
//   const map = {
//     "Parent": "Child", "Child": "Parent",
//     "Spouse": "Spouse", "Sibling": "Sibling",
//     "Grandparent": "Grandchild", "Grandchild": "Grandparent",
//     "Aunt/Uncle": "Niece/Nephew", "Niece/Nephew": "Aunt/Uncle",
//     // Other types might be symmetrical or not have a direct inverse.
//   };
//   return map[type];
// }

module.exports = router;

/*
=============================================================================
CONCEPTUAL API TESTS (Jest / Supertest Style)
=============================================================================

// const request = require('supertest');
// const app = require('../server'); // Assuming server.js exports the app
// const mongoose = require('mongoose');
// const User = require('../models/User');
// const Relationship = require('../models/Relationship');
// const jwt = require('jsonwebtoken'); // For decoding token to get userId if needed in tests
// let token; // Store user token for authenticated requests
// let userId;

// beforeAll(async () => { /* Connect to test DB, clear collections */ });
// afterAll(async () => { /* Disconnect from DB */ });
// beforeEach(async () => {
//   /* Clear User and Relationship collections */
//   /* Create a test user and get token */
//   // await User.deleteMany({});
//   // await Relationship.deleteMany({});
//   // const userRes = await request(app).post('/api/auth/register').send({ name: 'Main User', email: 'main@example.com', password: 'password123', birthYear: 1990 });
//   // token = userRes.body.token;
//   // const decoded = jwt.verify(token, process.env.JWT_SECRET);
//   // userId = decoded.user.id;
// });

describe('Relationships API: /api/relationships', () => {
  describe('POST /add', () => {
    it('should add a new relative (creating new user) and establish relationship if authenticated', async () => {
      // const res = await request(app)
      //   .post('/api/relationships/add')
      //   .set('x-auth-token', token)
      //   .send({
      //     relativeName: 'New Relative',
      //     relativeBirthYear: 2010,
      //     relativeEmail: 'newrelative@example.com', // Needs email to create new user
      //     relationshipType: 'Child'
      //   });
      // expect(res.statusCode).toEqual(200);
      // expect(res.body).toHaveProperty('relationship');
      // expect(res.body.relationship.user1).toEqual(userId);
      // expect(res.body.relative.email).toEqual('newrelative@example.com');
      // const newRelationship = await Relationship.findById(res.body.relationship._id);
      // expect(newRelationship).not.toBeNull();
      // const newRelativeUser = await User.findOne({ email: 'newrelative@example.com' });
      // expect(newRelativeUser).not.toBeNull();
    });

    it('should link to an existing user as relative and establish relationship', async () => {
      // const existingRelative = await new User({ name: 'Existing Relative', email: 'existingrel@example.com', password: 'password123', birthYear: 1980 }).save();
      // const res = await request(app)
      //   .post('/api/relationships/add')
      //   .set('x-auth-token', token)
      //   .send({
      //     relativeEmail: 'existingrel@example.com',
      //     relativeName: 'Existing Relative Name Should Be Ignored If User Exists By Email',
      //     relativeBirthYear: 1980, // This too
      //     relationshipType: 'Parent'
      //   });
      // expect(res.statusCode).toEqual(200);
      // expect(res.body.relationship.user2).toEqual(existingRelative._id.toString());
    });

    it('should fail to add relative if not authenticated', async () => {
      // const res = await request(app)
      //   .post('/api/relationships/add')
      //   .send({ relativeName: 'No Auth Relative', relativeBirthYear: 2000, relativeEmail: 'noauth@example.com', relationshipType: 'Sibling' });
      // expect(res.statusCode).toEqual(401);
      // expect(res.body.msg).toEqual('No token, authorization denied. Please log in.');
    });

    it('should fail if required fields like relativeName, relativeBirthYear, or relationshipType are missing', async () => {
      // const res = await request(app)
      //   .post('/api/relationships/add')
      //   .set('x-auth-token', token)
      //   .send({ relativeEmail: 'missingfields@example.com' }); // Missing name, birthYear, type
      // expect(res.statusCode).toEqual(400);
      // expect(res.body.msg).toEqual('Please provide relationship type, relative name, and birth year.');
    });

    it('should fail if trying to add self as relative using same email', async () => {
      // const currentUser = await User.findById(userId); // Fetch current user to get their email
      // const res = await request(app)
      //   .post('/api/relationships/add')
      //   .set('x-auth-token', token)
      //   .send({
      //     relativeEmail: currentUser.email, // Using current user's email
      //     relativeName: currentUser.name,
      //     relativeBirthYear: currentUser.birthYear,
      //     relationshipType: 'Sibling'
      //   });
      // expect(res.statusCode).toEqual(400);
      // expect(res.body.msg).toEqual('Cannot add yourself as a relative using your own email.');
    });

    it('should fail if creating a new relative profile without an email or phone when required by logic', async () => {
      // const res = await request(app)
      //   .post('/api/relationships/add')
      //   .set('x-auth-token', token)
      //   .send({ relativeName: 'No Contact Relative', relativeBirthYear: 2005, relationshipType: 'Child' });
      // expect(res.statusCode).toEqual(400);
      // expect(res.body.msg).toEqual('Relative email or phone is required to find or create a new profile for them.');
    });
  });

  describe('GET /myfamily', () => {
    it('should retrieve family relationships for an authenticated user', async () => {
      // // Add a relationship first for the main user
      // await request(app).post('/api/relationships/add').set('x-auth-token', token)
      //   .send({ relativeName: 'Test Child', relativeBirthYear: 2020, relativeEmail: 'child@example.com', relationshipType: 'Child' });

      // const res = await request(app)
      //   .get('/api/relationships/myfamily')
      //   .set('x-auth-token', token);
      // expect(res.statusCode).toEqual(200);
      // expect(Array.isArray(res.body)).toBe(true);
      // expect(res.body.length).toBeGreaterThan(0);
      // expect(res.body[0].user1).toHaveProperty('name');
      // expect(res.body[0].user2).toHaveProperty('name');
    });

    it('should return an empty array if user has no relationships', async () => {
      // // Create a new user who will have no relationships
      // const newUserRes = await request(app).post('/api/auth/register').send({ name: 'Lonely User', email: 'lonely@example.com', password: 'password123', birthYear: 1995 });
      // const lonelyToken = newUserRes.body.token;
      // const res = await request(app)
      //   .get('/api/relationships/myfamily')
      //   .set('x-auth-token', lonelyToken);
      // expect(res.statusCode).toEqual(200); // Should be 200, not 404, for an empty list
      // expect(Array.isArray(res.body)).toBe(true);
      // expect(res.body.length).toEqual(0);
    });

    it('should fail to retrieve family relationships if not authenticated', async () => {
      // const res = await request(app).get('/api/relationships/myfamily');
      // expect(res.statusCode).toEqual(401);
      // expect(res.body.msg).toEqual('No token, authorization denied. Please log in.');
    });
  });
});
*/
