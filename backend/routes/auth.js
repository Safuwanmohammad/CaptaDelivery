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

// In-memory OTP store (use Redis in production)
const otpStore = {};

// Normalise phone: always return 12 digits starting with '91'
function normalisePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return '91' + digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits; // fallback
}

// For 2Factor, we need the 10-digit number without country code
function getTenDigit(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  return digits;
}

// Helper: send OTP via 2Factor or console fallback
async function sendOtp(phone, otp) {
  const tenDigit = getTenDigit(phone);
  if (twoFactorInstance) {
    try {
      const sessionId = await twoFactorInstance.sendOTP(tenDigit, { otp });
      console.log(`✅ OTP sent to ${tenDigit} via 2Factor. Session: ${sessionId}`);
      return true;
    } catch (err) {
      console.error('❌ 2Factor error:', err.message);
      console.log(`📱 OTP for ${tenDigit}: ${otp}`);
      return false;
    }
  } else {
    console.log(`📱 OTP for ${tenDigit}: ${otp}`);
    return true;
  }
}

// ===== USER OTP =====
router.post('/send-otp', async (req, res) => {
  console.log('📥 /send-otp called with body:', req.body);
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
  console.log('📥 /verify-otp called with body:', req.body);
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP required' });
  }
  const normalized = normalisePhone(phone);
  if (otpStore[normalized] !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  // Find user in database
  const result = await pool.query('SELECT * FROM users WHERE phone = $1', [normalized]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No account found. Please sign up.' });
  }
  delete otpStore[normalized];
  res.json({ message: 'Login successful', user: result.rows[0] });
});

router.post('/register', async (req, res) => {
  console.log('📥 /register called with body:', req.body);
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
// Hardcoded admin numbers (always accepted)
const HARDCODED_ADMINS = ['919019825189', '918277079552', '919483685462'];
// Merge with environment variable if present
const envAdmins = (process.env.ADMIN_PHONES || '')
  .split(',')
  .map(p => p.trim())
  .filter(p => p.length > 0)
  .map(p => normalisePhone(p));
// Use both lists, remove duplicates
const ADMIN_PHONES = [...new Set([...HARDCODED_ADMINS, ...envAdmins])];

console.log('🔐 Admin phones (normalised):', ADMIN_PHONES);

router.post('/admin/send-otp', async (req, res) => {
  console.log('📥 /admin/send-otp called with body:', req.body);
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: 'Valid phone number required' });
  }
  const normalized = normalisePhone(phone);
  console.log(`Admin login attempt: raw="${phone}" -> normalized="${normalized}"`);
  console.log(`Admin list contains? ${ADMIN_PHONES.includes(normalized)}`);
  if (!ADMIN_PHONES.includes(normalized)) {
    return res.status(403).json({ error: 'Not authorized as admin' });
  }
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[normalized] = otp;
  await sendOtp(normalized, otp);
  res.json({ message: 'Admin OTP sent', otp });
});

router.post('/admin/verify-otp', async (req, res) => {
  console.log('📥 /admin/verify-otp called with body:', req.body);
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

module.exports = router;  // ✅ Must be present