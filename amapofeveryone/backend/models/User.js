const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema
 * Defines the structure for user documents in MongoDB.
 */
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name.'], // Name is required
    trim: true, // Remove whitespace from both ends of the string
  },
  birthYear: {
    type: Number,
    required: [true, 'Please provide a birth year.'], // Birth year is required
    // Additional validation for birth year can be added (e.g., min/max year)
    // validate: {
    //   validator: function(v) {
    //     return v > 1900 && v <= new Date().getFullYear();
    //   },
    //   message: props => `${props.value} is not a valid birth year!`
    // }
  },
  email: {
    type: String,
    required: [true, 'Please provide an email address.'], // Email is required
    unique: true, // Email must be unique across all users
    match: [ // Regular expression to validate email format
      /^\S+@\S+\.\S+$/,
      'Please provide a valid email address.',
    ],
    lowercase: true, // Convert email to lowercase before saving
    trim: true,
  },
  phone: {
    type: String,
    unique: true, // Phone number must be unique if provided
    sparse: true, // Allows multiple documents to have a null/missing phone field, enforcing uniqueness only when value is present
    trim: true,
    // Optional: Add a regex for phone number validation based on expected formats
    // match: [/^\+[1-9]\d{1,14}$/, 'Please provide a valid international phone number (e.g., +1234567890).']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password.'], // Password is required
    minlength: [6, 'Password must be at least 6 characters long.'], // Minimum password length
    select: false, // Password field will not be returned in queries by default
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically set to the current date and time when a user is created
  },
  inviteCode: {
    type: String,
    unique: true, // Ensures each invite code is unique across all users
    sparse: true, // Allows multiple users to not have an invite code (null/undefined),
                  // but if a value is present, it must be unique.
                  // Useful if codes are generated on-demand.
  },
  // You could add more fields here, e.g.:
  // profileVisibility: { type: String, enum: ['public', 'private', 'friends-only'], default: 'private' },
  // lastLogin: { type: Date }
});

/**
 * Mongoose Pre-save Middleware for Password Hashing.
 * This function automatically hashes the user's password before saving it to the database
 * if the password field has been modified (e.g., during registration or password update).
 */
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next(); // If password not modified, proceed to the next middleware/save operation
  }

  try {
    // Generate a salt (random bytes to add to password before hashing)
    const salt = await bcrypt.genSalt(10); // 10 rounds is generally considered secure
    // Hash the password using the generated salt
    this.password = await bcrypt.hash(this.password, salt);
    next(); // Proceed to save the user document
  } catch (error) {
    next(error); // If an error occurs during hashing, pass it to the next middleware/error handler
  }
});

/**
 * Mongoose Instance Method for Password Comparison.
 * Compares an entered password with the hashed password stored in the database for this user.
 * @param {string} enteredPassword - The password string entered by the user during login.
 * @returns {Promise<boolean>} A promise that resolves to true if passwords match, false otherwise.
 */
UserSchema.methods.comparePassword = async function (enteredPassword) {
  try {
    // Use bcrypt to compare the plain text password with the hashed password
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    // It's generally better to throw the error to be handled by the calling code,
    // rather than returning false, as false might be misinterpreted as just "passwords don't match".
    throw error;
  }
};

// Create and export the User model based on the UserSchema.
// The first argument 'User' is the singular name of the collection your model is for.
// Mongoose automatically looks for the plural, lowercased version of your model name (e.g., 'users').
module.exports = mongoose.model('User', UserSchema);
