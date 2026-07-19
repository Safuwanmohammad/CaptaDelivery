const express = require('express');
const router = express.Router();
const pool = require('../db');

// In-memory OTP store (use Redis in production)
const otpStore = {};

function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendOtp(phone, otp) {
  console.log(`📱 OTP for ${phone}: ${otp}`);
  return true;
}

// ===== HELPER: Normalize phone number =====
function normalizePhone(phone) {
  if (!phone) return '';
  // Remove spaces and dashes
  let cleaned = phone.replace(/[\s\-]/g, '');
  // If no + prefix, add +91
  if (!cleaned.startsWith('+')) {
    cleaned = '+91' + cleaned;
  }
  return cleaned;
}

// ===== HELPER: Get admin phones from settings =====
async function getAdminPhones() {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'admin_phones'");
    if (result.rows.length > 0) {
      try {
        const phones = JSON.parse(result.rows[0].value);
        // Ensure all phones are normalized
        return phones.map(p => normalizePhone(p));
      } catch (e) {
        console.error('Error parsing admin_phones:', e);
        return ['+919019825189', '+91827079552', '+919483685462'];
      }
    }
    // Default admin phones if not set in database
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
    
    await sendOtp(normalizedPhone, otp);
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
    }const express = require('express');
const router = express.Router();
const pool = require('../db');

const otpStore = {};

function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Get admin phones
async function getAdminPhones() {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'admin_phones'");
    if (result.rows.length > 0) {
      try {
        return JSON.parse(result.rows[0].value);
      } catch (e) {
        return ['+919019825189', '+91827079552', '+919483685462'];
      }
    }
    return ['+919019825189', '+91827079552', '+919483685462'];
  } catch (err) {
    return ['+919019825189', '+91827079552', '+919483685462'];
  }
}

// User OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number required' });
    }
    const otp = generateOtp();
    otpStore[phone] = otp;
    console.log(`📱 OTP for ${phone}: ${otp}`);
    res.json({ message: 'OTP sent', otp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP required' });
    }
    if (otpStore[phone] !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found' });
    }
    delete otpStore[phone];
    res.json({ message: 'Login successful', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, address, pincode, phone, otp } = req.body;
    if (!firstName || !lastName || !address || !pincode || !phone || !otp) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (otpStore[phone] !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    const existing = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, address, pincode, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [firstName, lastName, address, pincode, phone]
    );
    delete otpStore[phone];
    res.status(201).json({ message: 'Registration successful', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin OTP
router.post('/admin/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number required' });
    }
    const adminPhones = await getAdminPhones();
    const isAdmin = adminPhones.some(p => p === phone || p.replace('+91', '') === phone.replace('+91', ''));
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }
    const otp = generateOtp();
    otpStore[phone] = otp;
    console.log(`📱 Admin OTP for ${phone}: ${otp}`);
    res.json({ message: 'Admin OTP sent', otp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP required' });
    }
    const adminPhones = await getAdminPhones();
    const isAdmin = adminPhones.some(p => p === phone || p.replace('+91', '') === phone.replace('+91', ''));
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }
    if (otpStore[phone] !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    delete otpStore[phone];
    res.json({ message: 'Admin login successful', admin: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
    
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
    
    // Get admin phones from database
    const adminPhones = await getAdminPhones();
    
    // Check if phone is in admin list (case insensitive)
    const isAdmin = adminPhones.some(p => p === normalizedPhone);
    
    if (!isAdmin) {
      console.log(`❌ Phone ${normalizedPhone} not in admin list:`, adminPhones);
      return res.status(403).json({ 
        error: 'Not authorized as admin. Contact support to add your number.',
        // Remove in production - helps debugging
        adminPhones: adminPhones 
      });
    }
    
    const otp = generateOtp();
    otpStore[normalizedPhone] = otp;
    await sendOtp(normalizedPhone, otp);
    
    console.log(`✅ Admin OTP sent to ${normalizedPhone}`);
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
    
    // Get admin phones from database
    const adminPhones = await getAdminPhones();
    
    // Check if phone is in admin list
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

// ============================================================
// ADMIN UTILITY ROUTES
// ============================================================

// Get all admin phone numbers (for debugging)
router.get('/admin/phones', async (req, res) => {
  try {
    const adminPhones = await getAdminPhones();
    res.json({ adminPhones });
  } catch (err) {
    console.error('Get admin phones error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Add a new admin phone number
router.post('/admin/phones/add', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const currentPhones = await getAdminPhones();
    
    // Check if already exists
    if (currentPhones.some(p => p === normalizedPhone)) {
      return res.status(400).json({ error: 'Phone number already in admin list' });
    }
    
    // Add new phone
    currentPhones.push(normalizedPhone);
    const phonesJson = JSON.stringify(currentPhones);
    
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('admin_phones', $1) 
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [phonesJson, phonesJson]
    );
    
    res.json({ 
      success: true, 
      message: 'Admin phone added successfully',
      adminPhones: currentPhones
    });
  } catch (err) {
    console.error('Add admin phone error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Remove an admin phone number
router.delete('/admin/phones/remove', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    let currentPhones = await getAdminPhones();
    
    // Remove phone
    currentPhones = currentPhones.filter(p => p !== normalizedPhone);
    
    if (currentPhones.length === 0) {
      return res.status(400).json({ error: 'Cannot remove the last admin phone' });
    }
    
    const phonesJson = JSON.stringify(currentPhones);
    
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('admin_phones', $1) 
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [phonesJson, phonesJson]
    );
    
    res.json({ 
      success: true, 
      message: 'Admin phone removed successfully',
      adminPhones: currentPhones
    });
  } catch (err) {
    console.error('Remove admin phone error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;