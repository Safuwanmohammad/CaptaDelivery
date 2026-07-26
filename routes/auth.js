const express = require('express');
const router = express.Router();
const pool = require('../db');
const axios = require('axios');
const crypto = require('crypto');

// In-memory OTP store (use Redis in production)
const otpStore = {};

function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-]/g, '');
  cleaned = cleaned.replace(/[^0-9+]/g, '');
  
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = '+91' + cleaned;
  }
  return cleaned;
}

function formatPhoneFor2Factor(phone) {
  let formatted = phone.replace('+', '');
  if (formatted.startsWith('0')) {
    formatted = formatted.substring(1);
  }
  if (!formatted.startsWith('91')) {
    formatted = '91' + formatted;
  }
  return formatted;
}

// ============================================================
// SEND SMS OTP VIA 2FACTOR - WITH FULL DEBUGGING
// ============================================================
async function sendSmsOtp(phone, otp) {
  const startTime = Date.now();
  
  console.log('\n=================================================');
  console.log('📱 2FACTOR SMS SEND - START');
  console.log('=================================================');
  console.log(`  Phone:            ${phone}`);
  console.log(`  OTP:              ${otp}`);
  console.log(`  Timestamp:        ${new Date().toISOString()}`);
  console.log('=================================================');
  
  // Step 1: Check API Key
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  console.log(`\n🔑 API Key Check:`);
  console.log(`  TWO_FACTOR_API_KEY: ${apiKey ? '✅ PRESENT (length: ' + apiKey.length + ')' : '❌ MISSING'}`);
  
  if (!apiKey) {
    console.log('\n❌ CRITICAL: TWO_FACTOR_API_KEY is NOT set in environment!');
    console.log('=================================================\n');
    return { 
      success: false, 
      error: 'API_KEY_MISSING',
      details: 'TWO_FACTOR_API_KEY not set in environment variables'
    };
  }
  
  // Step 2: Format phone
  const formattedPhone = formatPhoneFor2Factor(phone);
  console.log(`\n📞 Phone Formatting:`);
  console.log(`  Original:         ${phone}`);
  console.log(`  Formatted:        ${formattedPhone}`);
  console.log(`  Valid:            ${/^[0-9]{10,13}$/.test(formattedPhone) ? '✅' : '❌'}`);
  
  // Step 3: Build request
  const templateName = 'OTP1';
  const url = `https://2factor.in/API/V1/${apiKey}/SMS/${formattedPhone}/${otp}/${templateName}`;
  const maskedUrl = url.replace(apiKey, '***MASKED***');
  
  console.log(`\n📤 Request Details:`);
  console.log(`  Method:           GET`);
  console.log(`  URL:              ${maskedUrl}`);
  console.log(`  Template:         ${templateName}`);
  console.log(`  Timeout:          30000ms`);
  console.log(`\n⏳ Sending request to 2Factor...`);
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const timeTaken = Date.now() - startTime;
    
    console.log(`\n📥 2Factor Response Received:`);
    console.log(`  Status Code:      ${response.status}`);
    console.log(`  Time Taken:       ${timeTaken}ms`);
    console.log(`  Response Body:`);
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.Status === 'Success') {
      console.log('\n✅ OTP SENT SUCCESSFULLY!');
      console.log('=================================================\n');
      return { 
        success: true, 
        data: response.data,
        message: 'OTP sent successfully via SMS'
      };
    } else {
      console.log('\n❌ 2Factor Rejected Request:');
      console.log(`  Status: ${response.data.Status}`);
      console.log(`  Details: ${response.data.Details || 'No details'}`);
      console.log('=================================================\n');
      return { 
        success: false, 
        error: response.data.Details || 'Unknown error',
        details: response.data
      };
    }
  } catch (err) {
    const timeTaken = Date.now() - startTime;
    
    console.log(`\n❌ ERROR SENDING OTP:`);
    console.log(`  Time Taken:       ${timeTaken}ms`);
    
    if (err.response) {
      console.log(`  Type:             HTTP Error`);
      console.log(`  Status:           ${err.response.status}`);
      console.log(`  Response:         ${JSON.stringify(err.response.data, null, 2)}`);
    } else if (err.request) {
      console.log(`  Type:             Network Error`);
      console.log(`  Code:             ${err.code || 'UNKNOWN'}`);
      console.log(`  Message:          ${err.message}`);
    } else {
      console.log(`  Type:             Setup Error`);
      console.log(`  Message:          ${err.message}`);
    }
    
    console.log('=================================================\n');
    
    return { 
      success: false, 
      error: err.message,
      code: err.code,
      details: err.response?.data
    };
  }
}

// ============================================================
// SEND OTP ROUTE - WITH FULL LOGGING
// ============================================================
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    
    console.log('\n=================================================');
    console.log('🚀 /send-otp ROUTE CALLED');
    console.log('=================================================');
    console.log(`  Timestamp:        ${new Date().toISOString()}`);
    console.log(`  Phone Received:   ${phone}`);
    console.log('=================================================');
    
    if (!phone || phone.length < 10) {
      console.log('❌ Invalid phone number');
      return res.status(400).json({ error: 'Valid phone number required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    console.log(`\n📱 Normalized Phone: ${normalizedPhone}`);
    
    const otp = generateOtp();
    console.log(`🔢 Generated OTP: ${otp}`);
    
    // Store OTP
    otpStore[normalizedPhone] = {
      otp: otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0
    };
    console.log(`💾 OTP Stored for ${normalizedPhone}`);
    
    // ============================================================
    // CRITICAL: Send SMS via 2Factor
    // ============================================================
    console.log('\n📤 CALLING sendSmsOtp()...');
    const result = await sendSmsOtp(normalizedPhone, otp);
    
    // ============================================================
    // Send Response
    // ============================================================
    console.log('\n📤 Sending Response to Client:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Message: ${result.message || result.error}`);
    
    if (result.success) {
      res.json({ 
        message: 'OTP sent successfully via SMS',
        otp: otp,
        smsFailed: false
      });
    } else {
      res.json({ 
        message: 'OTP generated but SMS failed. Check logs.',
        otp: otp,
        smsFailed: true,
        error: result.error,
        details: result.details
      });
    }
  } catch (err) {
    console.error('\n❌ UNHANDLED ERROR in /send-otp:');
    console.error(err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ============================================================
// VERIFY OTP
// ============================================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    console.log('\n=================================================');
    console.log('🔐 /verify-otp ROUTE CALLED');
    console.log('=================================================');
    console.log(`  Phone:            ${phone}`);
    console.log(`  OTP:              ${otp}`);
    console.log('=================================================');
    
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const stored = otpStore[normalizedPhone];
    
    if (!stored) {
      console.log('❌ No OTP found');
      return res.status(400).json({ error: 'No OTP found. Please request a new OTP.' });
    }
    
    console.log(`  Stored OTP:       ${stored.otp}`);
    console.log(`  Attempts:         ${stored.attempts}/5`);
    console.log(`  Expires At:       ${new Date(stored.expiresAt).toISOString()}`);
    
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
      console.log(`❌ Invalid OTP. Attempts remaining: ${5 - stored.attempts}`);
      return res.status(400).json({ 
        error: 'Invalid OTP', 
        attemptsRemaining: 5 - stored.attempts 
      });
    }
    
    console.log('✅ OTP verified successfully');
    delete otpStore[normalizedPhone];
    
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
    
    const result = await sendSmsOtp(normalizedPhone, otp);
    
    if (!result.success) {
      return res.json({ 
        message: 'OTP generated. SMS delivery failed. Check logs.',
        otp: otp,
        smsFailed: true,
        error: result.error
      });
    }
    
    res.json({ 
      message: 'Admin OTP sent successfully',
      otp: otp,
      smsFailed: false
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