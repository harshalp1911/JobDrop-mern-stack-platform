const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores anything past 72 bytes

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Register
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { password } = req.body;

  if (!name || !email || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  if (name.length > 100) {
    return res.status(400).json({ message: 'Name must be 100 characters or fewer' });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({
      message: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists with this email' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = new User({
    name,
    email,
    password: hashedPassword,
    authProvider: 'local',
  });

  await user.save();

  const token = generateToken(user._id);

  res.status(201).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    },
  });
}));

// Login
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { password } = req.body;

  if (!email || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  // Accounts created through Google have no password until they set one
  if (!user.password) {
    return res.status(400).json({ message: 'This account uses Google sign-in' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const token = generateToken(user._id);

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    },
  });
}));

// Google Auth
router.post('/google', authLimiter, asyncHandler(async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ message: 'Google credential is required' });
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (error) {
    // Expired, forged or wrong-audience token
    throw new HttpError(401, 'Google authentication failed');
  }

  const payload = ticket.getPayload();
  const { sub: googleId, email, name, picture, email_verified: emailVerified } = payload;

  // Only trust emails Google has verified; otherwise someone could claim
  // an existing account's address through an unverified Google identity.
  if (!emailVerified) {
    return res.status(401).json({ message: 'Your Google email address is not verified' });
  }

  let user = await User.findOne({ email });

  if (user) {
    if (!user.googleId) {
      // Link Google to the existing account but keep its password login working
      user.googleId = googleId;
      if (picture && !user.avatar) user.avatar = picture;
      await user.save();
    } else if (user.googleId !== googleId) {
      return res.status(401).json({ message: 'This email is linked to a different Google account' });
    }
  } else {
    user = new User({
      name,
      email,
      googleId,
      avatar: picture,
      authProvider: 'google',
    });
    await user.save();
  }

  const token = generateToken(user._id);

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    },
  });
}));

// Get current user
router.get('/me', auth, asyncHandler(async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
    },
  });
}));

module.exports = router;
