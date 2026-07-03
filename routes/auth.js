const express = require('express');
const router = express.Router();
const pool = require('../db');
const twilio = require('twilio');

// Optional Twilio client (fallback to console if not configured)
let twilioClient = null;
try {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
} catch (e) {
  console.warn('Twilio not configured – OTP will be printed in console.');
}

// In-memory OTP store (use Redis in production)
const otpStore = {};

function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendOtp(phone, otp) {
  const message = `Your CaptaDelivery OTP is: ${otp}`;
  
  if (twilioClient) {
    try {
      await twilioClient.messages.create({
        body: message,
        to: phone,
        from: process.env.TWILIO_PHONE_NUMBER
      });
      console.log(`✅ OTP sent to ${phone}: ${otp}`);
      return true;
    } catch (err) {
      console.error('❌ Twilio error:', err.message);
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
  const otp = generateOtp();
  otpStore[phone] = otp;
  await sendOtp(phone, otp);
  // For development, return OTP (remove in production)
  res.json({ message: 'OTP sent', otp });
});

router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP required' });
  }
  if (otpStore[phone] !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No account found. Please sign up.' });
  }
  delete otpStore[phone];
  res.json({ message: 'Login successful', user: result.rows[0] });
});

router.post('/register', async (req, res) => {
  const { firstName, lastName, address, pincode, phone, otp } = req.body;
  if (!firstName || !lastName || !address || !pincode || !phone || !otp) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (otpStore[phone] !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  const existing = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'User already exists. Please login.' });
  }
  const result = await pool.query(
    `INSERT INTO users (first_name, last_name, address, pincode, phone)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [firstName, lastName, address, pincode, phone]
  );
  delete otpStore[phone];
  res.status(201).json({ message: 'Registration successful', user: result.rows[0] });
});

// ===== ADMIN OTP =====
router.post('/admin/send-otp', async (req, res) => {
  const { phone } = req.body;
  const adminPhone = process.env.ADMIN_PHONE;
  if (!phone || phone !== adminPhone) {
    return res.status(403).json({ error: 'Not authorized as admin' });
  }
  const otp = generateOtp();
  otpStore[phone] = otp;
  await sendOtp(phone, otp);
  res.json({ message: 'Admin OTP sent', otp });
});

router.post('/admin/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  const adminPhone = process.env.ADMIN_PHONE;
  if (phone !== adminPhone) {
    return res.status(403).json({ error: 'Not authorized as admin' });
  }
  if (otpStore[phone] !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  delete otpStore[phone];
  res.json({ message: 'Admin login successful', admin: true });
});

module.exports = router;