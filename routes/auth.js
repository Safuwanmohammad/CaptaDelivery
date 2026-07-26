const express = require('express');
const router = express.Router();
const pool = require('../db');
const axios = require('axios');

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

// ============================================================
// SEND SMS OTP VIA 2FACTOR
// ============================================================
async function sendSmsOtp(phone, otp) {
  try {
    const apiKey = process.env.TWO_FACTOR_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ 2Factor API key not configured, using demo OTP');
      return { success: true, isDemo: true };
    }
    
    // 2Factor.in API endpoint for SMS OTP
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/${phone}/${otp}/OTP1`;
    
    const response = await axios.get(url);
    console.log('📱 2Factor SMS response:', response.data);
    
    if (response.data.Status === 'Success') {
      return { success: true, data: response.data };
    } else {
      console.error('❌ 2Factor SMS error:', response.data);
      return { success: false, error: response.data.Details || 'SMS sending failed' };
    }
  } catch (err) {
    console.error('❌ 2Factor SMS exception:', err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// SEND OTP FOR USER LOGIN
// ============================================================
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const otp = generateOtp();
    
    // Store OTP with expiry (10 minutes)
    otpStore[normalizedPhone] = {
      otp: otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0
    };
    
    console.log(`📱 OTP for ${normalizedPhone}: ${otp}`);
    
    // Send SMS via 2Factor
    const result = await sendSmsOtp(normalizedPhone, otp);
    
    if (!result.success && !result.isDemo) {
      console.error('❌ Failed to send SMS OTP:', result.error);
      // Still return the OTP for demo purposes
      return res.json({ 
        message: 'OTP generated (SMS failed, check console for OTP)', 
        otp: otp,
        smsFailed: true
      });
    }
    
    res.json({ 
      message: 'OTP sent via SMS', 
      otp: otp,
      isDemo: result.isDemo || false
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ============================================================
// VERIFY OTP
// ============================================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const stored = otpStore[normalizedPhone];
    
    if (!stored) {
      return res.status(400).json({ error: 'No OTP found. Please request a new OTP.' });
    }
    
    if (stored.attempts >= 5) {
      delete otpStore[normalizedPhone];
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }
    
    if (Date.now() > stored.expiresAt) {
      delete otpStore[normalizedPhone];
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }
    
    if (stored.otp !== otp) {
      stored.attempts += 1;
      return res.status(400).json({ 
        error: 'Invalid OTP', 
        attemptsRemaining: 5 - stored.attempts 
      });
    }
    
    // OTP verified successfully
    delete otpStore[normalizedPhone];
    
    // Check if user exists
    const result = await pool.query('SELECT * FROM users WHERE phone = $1', [normalizedPhone]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found. Please sign up.' });
    }
    
    res.json({ message: 'Login successful', user: result.rows[0] });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ============================================================
// REGISTER NEW USER
// ============================================================
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, address, pincode, phone, otp } = req.body;
    
    if (!firstName || !lastName || !address || !pincode || !phone || !otp) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const stored = otpStore[normalizedPhone];
    
    if (!stored) {
      return res.status(400).json({ error: 'No OTP found. Please request a new OTP.' });
    }
    
    if (stored.attempts >= 5) {
      delete otpStore[normalizedPhone];
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }
    
    if (Date.now() > stored.expiresAt) {
      delete otpStore[normalizedPhone];
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }
    
    if (stored.otp !== otp) {
      stored.attempts += 1;
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    delete otpStore[normalizedPhone];
    
    const existing = await pool.query('SELECT * FROM users WHERE phone = $1', [normalizedPhone]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists. Please login.' });
    }
    
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, address, pincode, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [firstName, lastName, address, pincode, normalizedPhone]
    );
    
    res.status(201).json({ message: 'Registration successful', user: result.rows[0] });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ============================================================
// ADMIN OTP ROUTES
// ============================================================

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
    otpStore[normalizedPhone] = {
      otp: otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0
    };
    
    console.log(`📱 Admin OTP for ${normalizedPhone}: ${otp}`);
    
    // Send SMS via 2Factor
    const result = await sendSmsOtp(normalizedPhone, otp);
    
    res.json({ 
      message: 'Admin OTP sent', 
      otp: otp,
      isDemo: result.isDemo || false
    });
  } catch (err) {
    console.error('Admin send OTP error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

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
    
    const stored = otpStore[normalizedPhone];
    
    if (!stored) {
      return res.status(400).json({ error: 'No OTP found. Please request a new OTP.' });
    }
    
    if (stored.attempts >= 5) {
      delete otpStore[normalizedPhone];
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }
    
    if (Date.now() > stored.expiresAt) {
      delete otpStore[normalizedPhone];
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }
    
    if (stored.otp !== otp) {
      stored.attempts += 1;
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