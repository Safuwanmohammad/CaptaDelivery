const express = require('express');
const router = express.Router();
const pool = require('../db');

// In-memory OTP store (use Redis in production)
const otpStore = {};

function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-]/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = '+91' + cleaned;
  }
  return cleaned;
}

async function getAdminPhones() {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'admin_phones'");
    if (result.rows.length > 0) {
      try {
        const phones = JSON.parse(result.rows[0].value);
        return phones.map(p => normalizePhone(p));
      } catch (e) {
        return ['+919019825189', '+91827079552', '+919483685462'];
      }
    }
    return ['+919019825189', '+91827079552', '+919483685462'];
  } catch (err) {
    console.error('Error fetching admin phones:', err.message);
    return ['+919019825189', '+91827079552', '+919483685462'];
  }
}

// ============================================================
// USER OTP ROUTES
// ============================================================

// Send OTP for user login
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const otp = generateOtp();
    otpStore[normalizedPhone] = otp;
    
    console.log(`📱 OTP for ${normalizedPhone}: ${otp}`);
    res.json({ message: 'OTP sent', otp });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Verify OTP for user login
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    
    if (otpStore[normalizedPhone] !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    const result = await pool.query('SELECT * FROM users WHERE phone = $1', [normalizedPhone]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found. Please sign up.' });
    }
    
    delete otpStore[normalizedPhone];
    res.json({ message: 'Login successful', user: result.rows[0] });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, address, pincode, phone, otp } = req.body;
    
    if (!firstName || !lastName || !address || !pincode || !phone || !otp) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    
    if (otpStore[normalizedPhone] !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    const existing = await pool.query('SELECT * FROM users WHERE phone = $1', [normalizedPhone]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists. Please login.' });
    }
    
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, address, pincode, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [firstName, lastName, address, pincode, normalizedPhone]
    );
    
    delete otpStore[normalizedPhone];
    res.status(201).json({ message: 'Registration successful', user: result.rows[0] });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ============================================================
// ADMIN OTP ROUTES
// ============================================================

// Send OTP for admin login
router.post('/admin/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const adminPhones = await getAdminPhones();
    const isAdmin = adminPhones.some(p => p === normalizedPhone);
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }
    
    const otp = generateOtp();
    otpStore[normalizedPhone] = otp;
    
    console.log(`📱 Admin OTP for ${normalizedPhone}: ${otp}`);
    res.json({ message: 'Admin OTP sent', otp });
  } catch (err) {
    console.error('Admin send OTP error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Verify OTP for admin login
router.post('/admin/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const adminPhones = await getAdminPhones();
    const isAdmin = adminPhones.some(p => p === normalizedPhone);
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }
    
    if (otpStore[normalizedPhone] !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    delete otpStore[normalizedPhone];
    res.json({ message: 'Admin login successful', admin: true });
  } catch (err) {
    console.error('Admin verify OTP error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;