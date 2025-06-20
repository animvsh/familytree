// amapofeveryone/backend/routes/user.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto'); // For generating random string
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

/**
 * @route   POST /api/users/me/generate-invite-code
 * @desc    Generate or retrieve the authenticated user's invite code.
 *          If the user already has an invite code, it's returned.
 *          Otherwise, a new unique code is generated, saved to the user, and returned.
 * @access  Private (requires authentication)
 * @param   {object} req.user - Attached by authMiddleware, contains authenticated user's ID.
 * @returns {object} JSON object containing the user's inviteCode.
 *                   Or an error message if user not found or server error.
 */
router.post('/me/generate-invite-code', authMiddleware, async (req, res) => {
  try {
    // Find the authenticated user in the database
    const user = await User.findById(req.user.id);
    if (!user) {
      // This should ideally not happen if token is valid and user hasn't been deleted
      return res.status(404).json({ msg: 'User not found.' });
    }

    // If user already has an invite code, return it
    if (user.inviteCode) {
      return res.json({ inviteCode: user.inviteCode });
    }

    // Generate a new unique invite code
    let newInviteCode;
    let isCodeUnique = false;
    let attempts = 0; // To prevent infinite loop in extremely rare cases
    const MAX_ATTEMPTS = 10;

    while (!isCodeUnique && attempts < MAX_ATTEMPTS) {
      newInviteCode = crypto.randomBytes(4).toString('hex'); // Generates an 8-character hexadecimal string
      const existingUserWithCode = await User.findOne({ inviteCode: newInviteCode });
      if (!existingUserWithCode) {
        isCodeUnique = true; // Code is unique
      }
      attempts++;
    }

    if (!isCodeUnique) {
      // Could not generate a unique code after several attempts
      console.error('Failed to generate a unique invite code after multiple attempts.');
      return res.status(500).json({ msg: 'Could not generate a unique invite code. Please try again later.' });
    }

    // Assign the new unique code to the user and save the user document
    user.inviteCode = newInviteCode;
    await user.save();

    // Return the newly generated invite code
    res.json({ inviteCode: user.inviteCode });

  } catch (err) {
    console.error('Error in /me/generate-invite-code:', err.message);
    // Handle potential errors during DB operations or other unexpected issues
    res.status(500).json({ msg: 'Server error while generating invite code.' });
  }
});

module.exports = router;

/**
 * @route   GET /api/users/info-by-invite-code/:inviteCode
 * @desc    Get basic info (name) of a user by their invite code.
 * @access  Public
 */
router.get('/info-by-invite-code/:inviteCode', async (req, res) => {
  try {
    const inviteCode = req.params.inviteCode;
    if (!inviteCode) {
      return res.status(400).json({ msg: 'Invite code is required.' });
    }

    // Find user by inviteCode. Only select the 'name' field for privacy.
    const user = await User.findOne({ inviteCode }).select('name');

    if (!user) {
      return res.status(404).json({ msg: 'Inviter not found or invalid invite code.' });
    }

    res.json({ inviterName: user.name });

  } catch (err) {
    console.error('Error fetching user by invite code:', err.message);
    res.status(500).json({ msg: 'Server error while fetching inviter information.' });
  }
});
