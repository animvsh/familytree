const jwt = require('jsonwebtoken');
// User model might be needed if you want to check if the user from token still exists in DB.
// const User = require('../models/User');

/**
 * Authentication Middleware.
 * Verifies a JWT token provided in the 'x-auth-token' header of a request.
 * If the token is valid, it attaches the decoded user payload (containing user ID)
 * to the `req.user` object, allowing subsequent route handlers to access authenticated user's info.
 * If the token is missing or invalid, it sends an appropriate HTTP error response.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
module.exports = async function (req, res, next) {
  // Get token from the 'x-auth-token' header
  const token = req.header('x-auth-token');

  // Check if no token is present in the header
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied. Please log in.' });
  }

  try {
    // Verify the token using the JWT_SECRET from environment variables.
    // jwt.verify will throw an error if the token is invalid (e.g., expired, malformed, wrong secret).
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the 'user' part of the decoded payload to the request object.
    // This typically contains the user's ID (e.g., { user: { id: 'someUserId' } }).
    req.user = decoded.user;

    // Optional: Check if the user from the token still exists in the database.
    // This adds an extra layer of security, e.g., if a user account was deleted after token issuance.
    // However, it adds a database query to every authenticated request, impacting performance.
    // Enable if this check is critical for your application's security model.
    /*
    const userExists = await User.findById(req.user.id);
    if (!userExists) {
      return res.status(401).json({ msg: 'User not found, authorization denied.' });
    }
    */

    // If token is valid (and user exists, if checked), proceed to the next middleware or route handler.
    next();
  } catch (err) {
    // Handle errors during token verification (e.g., JsonWebTokenError, TokenExpiredError)
    console.error('Token verification error:', err.message);
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ msg: 'Token is expired, please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ msg: 'Token is not valid, authorization denied.' });
    }
    // For other unexpected errors during verification
    res.status(401).json({ msg: 'Token is not valid or an authentication error occurred.' });
  }
};
