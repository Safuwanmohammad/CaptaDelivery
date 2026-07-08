const express = require('express');
const router = express.Router();
const pool = require('../db');

const TwoFactor = require('2factor');
const API_KEY = process.env.TWO_FACTOR_API_KEY;
let twoFactorInstance = null;
if (API_KEY) {
  twoFactorInstance = new TwoFactor(API_KEY);
} else {
  console.warn('⚠️ 2Factor API key missing – OTP will be printed to console.');
}

const otpStore = {};

// Normalise phone to a standard format: always starts with 91, 12 digits
function normalisePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return '91' + digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits; // fallback
}

async function sendOtp(phone, otp) {
  const cleanPhone = phone.replace(/\D/g, '');
  if (twoFactorInstance) {
    try {
      const sessionId = await twoFactorInstance.sendOTP(cleanPhone, { otp });
      console.log(`✅ OTP sent to ${phone} via 2Factor. Session: ${sessionId}`);
      return true;
    } catch (err) {
      console.error('❌ 2Factor error:', err.message);
      console.log(`📱 OTP for ${phone}: ${otp}`);
      return false;
    }
  } else {
    console.log(`📱 OTP for ${phone}: ${otp}`);
    return true;
  }
}

// ===== USER OTP =====
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: 'Valid phone number required' });
  }
  const normalized = normalisePhone(phone);
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[normalized] = otp;
  await sendOtp(normalized, otp);
  res.json({ message: 'OTP sent', otp });
});

router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP required' });
  }
  const normalized = normalisePhone(phone);
  if (otpStore[normalized] !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  const result = await pool.query('SELECT * FROM users WHERE phone = $1', [normalized]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No account found. Please sign up.' });
  }
  delete otpStore[normalized];
  res.json({ message: 'Login successful', user: result.rows[0] });
});

router.post('/register', async (req, res) => {
  const { firstName, lastName, address, pincode, phone, otp } = req.body;
  if (!firstName || !lastName || !address || !pincode || !phone || !otp) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const normalized = normalisePhone(phone);
  if (otpStore[normalized] !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  const existing = await pool.query('SELECT * FROM users WHERE phone = $1', [normalized]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'User already exists. Please login.' });
  }
  const result = await pool.query(
    `INSERT INTO users (first_name, last_name, address, pincode, phone)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [firstName, lastName, address, pincode, normalized]
  );
  delete otpStore[normalized];
  res.status(201).json({ message: 'Registration successful', user: result.rows[0] });
});

// ===== ADMIN OTP =====
// Hardcoded fallback list (in case env var is missing)
const DEFAULT_ADMIN_PHONES = '+919019825189,+918277079552,+919483685462';
const adminPhonesEnv = process.env.ADMIN_PHONES || DEFAULT_ADMIN_PHONES;
const ADMIN_PHONES = adminPhonesEnv
  .split(',')
  .map(p => p.trim())
  .filter(p => p.length > 0)
  .map(p => normalisePhone(p));

// Log the admin list at startup
console.log('🔐 Admin phones (normalised):', ADMIN_PHONES);

router.post('/admin/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: 'Valid phone number required' });
  }
  const normalized = normalisePhone(phone);
  console.log(`Admin login attempt: raw=${phone}, normalized=${normalized}`);
  console.log(`Admin list: ${ADMIN_PHONES.join(', ')}`);
  if (!ADMIN_PHONES.includes(normalized)) {
    return res.status(403).json({ error: 'Not authorized as admin' });
  }
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[normalized] = otp;
  await sendOtp(normalized, otp);
  res.json({ message: 'Admin OTP sent', otp });
});

router.post('/admin/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  const normalized = normalisePhone(phone);
  if (!ADMIN_PHONES.includes(normalized)) {
    return res.status(403).json({ error: 'Not authorized as admin' });
  }
  if (otpStore[normalized] !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  delete otpStore[normalized];
  res.json({ message: 'Admin login successful', admin: true });
});

module.exports = router;