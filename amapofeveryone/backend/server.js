// Import necessary modules
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const relationshipRoutes = require('./routes/relationships');
const userRoutes = require('./routes/user'); // Import user routes

// Initialize Express application
const app = express();

// Middleware to parse JSON request bodies
// This allows the application to accept JSON data in requests (e.g., for POST, PUT)
app.use(express.json());

// MongoDB Connection URI
// Uses the environment variable MONGO_URI if set, otherwise defaults to a local MongoDB instance.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/amapofeveryone';

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true, // Uses the new URL string parser
  useUnifiedTopology: true, // Uses the new server discovery and monitoring engine
  // Mongoose 6 and later have useCreateIndex and useFindAndModify set to true by default,
  // so they are no longer needed in the options.
}).then(() => console.log('MongoDB Connected successfully.'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    // Consider exiting the process if the database connection is critical for the application start.
    // process.exit(1);
  });

// Define API Routes

// Authentication routes (e.g., register, login)
// All routes defined in './routes/auth' will be prefixed with '/api/auth'
app.use('/api/auth', authRoutes);

// Relationship routes (e.g., add relative, get family tree)
// All routes defined in './routes/relationships' will be prefixed with '/api/relationships'
app.use('/api/relationships', relationshipRoutes);

// User-specific routes (e.g., generating invite codes, profile updates)
// All routes defined in './routes/user' will be prefixed with '/api/users'
app.use('/api/users', userRoutes);


/**
 * @route   GET /
 * @desc    Root endpoint for the API.
 * @access  Public
 * @returns {object} JSON object with a welcome message.
 */
app.get('/', (req, res) => {
  // Send a JSON response indicating the API is running
  res.json({ msg: 'amapofeveryone Backend API is running' });
});

// Define the port for the server
// Uses the environment variable PORT if set, otherwise defaults to 5000.
const PORT = process.env.PORT || 5000;

// Start the server and listen on the defined port
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Basic JWT Secret setup
// This is a fallback for development if JWT_SECRET is not set in environment variables.
// For production, JWT_SECRET *must* be set as an environment variable for security.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'your_jwt_secret_for_development_only';
  console.warn('CRITICAL SECURITY WARNING: JWT_SECRET is not set in environment variables. Using a default, insecure secret for development. This MUST be changed for production.');
}
