const express = require('express');
const router = express.Router();
const pool = require('../db');
const axios = require('axios');

// ============================================================
// CONFIGURATION
// ============================================================
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

// ============================================================
// SESSION STORE - Stores ONLY session ID from 2Factor
// NO OTP is ever stored here
// ============================================================
const sessionStore = {};

// ============================================================
// HELPERS
// ============================================================

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
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

function getApiKey() {
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  if (!apiKey) {
    console.error('❌ TWO_FACTOR_API_KEY is not set');
    return null;
  }
  return apiKey;
}

// ============================================================
// 2FACTOR AUTOGEN API - Generates OTP on 2Factor servers
// ============================================================
async function call2FactorAutogen(phone) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: 'API_KEY_MISSING' };
  }

  const formattedPhone = formatPhoneFor2Factor(phone);
  
  console.log('=================================================');
  console.log('📤 2Factor AUTOGEN REQUEST (SMS)');
  console.log('=================================================');
  console.log(`  Phone:          ${formattedPhone}`);
  console.log(`  API Key:        ${apiKey ? '✅ Present' : '❌ Missing'}`);
  console.log(`  Endpoint:       SMS/AUTOGEN/OTP1`);
  console.log('=================================================');
  
  const url = `https://2factor.in/API/V1/${apiKey}/SMS/${formattedPhone}/AUTOGEN/OTP1`;

  try {
    console.log('⏳ Sending request to 2Factor...');
    const response = await axios({
      method: 'GET',
      url: url,
      timeout: 30000
    });

    console.log('\n=================================================');
    console.log('📥 2Factor AUTOGEN RESPONSE');
    console.log('=================================================');
    console.log(`  Status Code:    ${response.status}`);
    console.log(`  Response:       ${JSON.stringify(response.data, null, 2)}`);
    console.log('=================================================\n');

    if (response.data && response.data.Status === 'Success') {
      const sessionId = response.data.Details;
      if (!sessionId) {
        return { success: false, error: 'NO_SESSION_ID' };
      }
      console.log(`✅ Session ID: ${sessionId.substring(0, 8)}...`);
      return { success: true, sessionId: sessionId };
    } else {
      const errorMsg = response.data?.Details || response.data?.Message || 'Unknown error';
      console.log(`❌ 2Factor Error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (err) {
    console.log('\n=================================================');
    console.log('❌ 2Factor AUTOGEN ERROR');
    console.log('=================================================');
    if (err.response) {
      console.log(`  Status: ${err.response.status}`);
      console.log(`  Data: ${JSON.stringify(err.response.data, null, 2)}`);
    } else if (err.request) {
      console.log(`  No response: ${err.message}`);
    } else {
      console.log(`  Error: ${err.message}`);
    }
    console.log('=================================================\n');
    return { success: false, error: err.message };
  }
}

// ============================================================
// 2FACTOR VERIFY API - Verifies OTP using session ID
// ============================================================
async function call2FactorVerify(sessionId, otp) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: 'API_KEY_MISSING' };
  }

  console.log('=================================================');
  console.log('📤 2Factor VERIFY REQUEST');
  console.log('=================================================');
  console.log(`  Session ID:     ${sessionId.substring(0, 8)}...`);
  console.log(`  OTP:            ${otp ? '✅ Provided' : '❌ Missing'}`);
  console.log('=================================================');

  const url = `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${sessionId}/${otp}`;

  try {
    console.log('⏳ Sending verify request to 2Factor...');
    const response = await axios({
      method: 'GET',
      url: url,
      timeout: 30000
    });

    console.log('\n=================================================');
    console.log('📥 2Factor VERIFY RESPONSE');
    console.log('=================================================');
    console.log(`  Status Code:    ${response.status}`);
    console.log(`  Response:       ${JSON.stringify(response.data, null, 2)}`);
    console.log('=================================================\n');

    if (response.data && response.data.Status === 'Success') {
      return { success: true };
    } else {
      const errorMsg = response.data?.Details || response.data?.Message || 'Invalid OTP';
      return { success: false, error: errorMsg };
    }
  } catch (err) {
    console.log('\n=================================================');
    console.log('❌ 2Factor VERIFY ERROR');
    console.log('=================================================');
    if (err.response) {
      console.log(`  Status: ${err.response.status}`);
      console.log(`  Data: ${JSON.stringify(err.response.data, null, 2)}`);
    } else if (err.request) {
      console.log(`  No response: ${err.message}`);
    } else {
      console.log(`  Error: ${err.message}`);
    }
    console.log('=================================================\n');
    return { success: false, error: err.message };
  }
}

// ============================================================
// ROUTE: SEND OTP - NO LOCAL OTP GENERATION
// ============================================================
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    
    console.log('\n=================================================');
    console.log('📱 SEND OTP REQUEST');
    console.log('=================================================');
    console.log(`  Phone: ${phone}`);
    console.log('=================================================');

    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid phone number required' });
    }

    const normalizedPhone = normalizePhone(phone);
    console.log(`📱 Normalized: ${normalizedPhone}`);

    const result = await call2FactorAutogen(normalizedPhone);

    if (!result.success) {
      console.log(`❌ OTP send failed: ${result.error}`);
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    sessionStore[normalizedPhone] = {
      sessionId: result.sessionId,
      expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
      attempts: 0
    };

    console.log(`✅ Session stored for ${normalizedPhone}`);
    console.log(`   Session ID: ${result.sessionId.substring(0, 8)}...`);
    console.log(`   Expires: ${new Date(sessionStore[normalizedPhone].expiresAt).toISOString()}`);
    console.log('=================================================\n');

    res.json({
      success: true,
      message: 'OTP sent successfully to your phone'
    });

  } catch (err) {
    console.error('❌ SEND OTP ERROR:', err);
    res.status(500).json({
      success: false,
      error: 'Server error. Please try again.'
    });
  }
});

// ============================================================
// ROUTE: VERIFY OTP - Uses 2Factor Verify API
// ============================================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    console.log('\n=================================================');
    console.log('🔐 VERIFY OTP REQUEST');
    console.log('=================================================');
    console.log(`  Phone: ${phone}`);
    console.log(`  OTP: ${otp ? '✅ Provided' : '❌ Missing'}`);
    console.log('=================================================');

    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Phone and OTP required' });
    }

    const normalizedPhone = normalizePhone(phone);
    const stored = sessionStore[normalizedPhone];

    if (!stored) {
      console.log('❌ No session found');
      return res.status(400).json({ 
        success: false, 
        error: 'No OTP requested. Please request a new OTP.' 
      });
    }

    console.log(`📋 Session found:`);
    console.log(`  Session ID: ${stored.sessionId.substring(0, 8)}...`);
    console.log(`  Attempts: ${stored.attempts}/${MAX_ATTEMPTS}`);
    console.log(`  Expires: ${new Date(stored.expiresAt).toISOString()}`);

    if (stored.attempts >= MAX_ATTEMPTS) {
      delete sessionStore[normalizedPhone];
      return res.status(400).json({ 
        success: false, 
        error: 'Too many failed attempts. Please request a new OTP.' 
      });
    }

    if (Date.now() > stored.expiresAt) {
      delete sessionStore[normalizedPhone];
      return res.status(400).json({ 
        success: false, 
        error: 'OTP has expired. Please request a new OTP.' 
      });
    }

    const result = await call2FactorVerify(stored.sessionId, otp);

    if (!result.success) {
      stored.attempts += 1;
      console.log(`❌ Verification failed. Attempts: ${stored.attempts}/${MAX_ATTEMPTS}`);
      return res.status(400).json({
        success: false,
        error: result.error,
        attemptsRemaining: MAX_ATTEMPTS - stored.attempts
      });
    }

    delete sessionStore[normalizedPhone];
    console.log('✅ OTP verified successfully');
    console.log('=================================================\n');

    const userResult = await pool.query(
      'SELECT * FROM users WHERE phone = $1',
      [normalizedPhone]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No account found. Please sign up.' 
      });
    }

    res.json({ 
      success: true,
      message: 'Login successful', 
      user: userResult.rows[0] 
    });

  } catch (err) {
    console.error('❌ VERIFY OTP ERROR:', err);
    res.status(500).json({
      success: false,
      error: 'Server error. Please try again.'
    });
  }
});

// ============================================================
// ROUTE: REGISTER
// ============================================================
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, address, pincode, phone, otp } = req.body;

    console.log('\n=================================================');
    console.log('📝 REGISTER REQUEST');
    console.log('=================================================');
    console.log(`  Phone: ${phone}`);
    console.log(`  OTP: ${otp ? '✅ Provided' : '❌ Missing'}`);
    console.log('=================================================');

    if (!firstName || !lastName || !address || !pincode || !phone || !otp) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    const normalizedPhone = normalizePhone(phone);
    const stored = sessionStore[normalizedPhone];

    if (!stored) {
      return res.status(400).json({ 
        success: false, 
        error: 'No OTP requested. Please request a new OTP.' 
      });
    }

    if (stored.attempts >= MAX_ATTEMPTS) {
      delete sessionStore[normalizedPhone];
      return res.status(400).json({ 
        success: false, 
        error: 'Too many failed attempts. Please request a new OTP.' 
      });
    }

    if (Date.now() > stored.expiresAt) {
      delete sessionStore[normalizedPhone];
      return res.status(400).json({ 
        success: false, 
        error: 'OTP has expired. Please request a new OTP.' 
      });
    }

    const result = await call2FactorVerify(stored.sessionId, otp);

    if (!result.success) {
      stored.attempts += 1;
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    delete sessionStore[normalizedPhone];
    console.log('✅ OTP verified for registration');

    const existing = await pool.query(
      'SELECT * FROM users WHERE phone = $1',
      [normalizedPhone]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'User already exists. Please login.' 
      });
    }

    const result2 = await pool.query(
      `INSERT INTO users (first_name, last_name, address, pincode, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [firstName, lastName, address, pincode, normalizedPhone]
    );

    console.log('✅ User registered successfully');
    console.log('=================================================\n');

    res.status(201).json({ 
      success: true,
      message: 'Registration successful', 
      user: result2.rows[0] 
    });

  } catch (err) {
    console.error('❌ REGISTER ERROR:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Server error. Please try again.' 
    });
  }
});

// ============================================================
// ADMIN ROUTES
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
      return res.status(400).json({ success: false, error: 'Valid phone number required' });
    }

    const normalizedPhone = normalizePhone(phone);
    const adminPhones = await getAdminPhones();
    const isAdmin = adminPhones.some(p => p === normalizedPhone);

    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized as admin' });
    }

    console.log(`📱 Admin OTP for ${normalizedPhone}`);
    const result = await call2FactorAutogen(normalizedPhone);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    sessionStore[normalizedPhone] = {
      sessionId: result.sessionId,
      expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
      attempts: 0
    };

    res.json({ success: true, message: 'Admin OTP sent successfully' });

  } catch (err) {
    console.error('❌ ADMIN SEND OTP ERROR:', err);
    res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }
});

router.post('/admin/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Phone and OTP required' });
    }

    const normalizedPhone = normalizePhone(phone);
    const adminPhones = await getAdminPhones();
    const isAdmin = adminPhones.some(p => p === normalizedPhone);

    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized as admin' });
    }

    const stored = sessionStore[normalizedPhone];

    if (!stored) {
      return res.status(400).json({ success: false, error: 'No OTP requested. Please request a new OTP.' });
    }

    if (stored.attempts >= MAX_ATTEMPTS) {
      delete sessionStore[normalizedPhone];
      return res.status(400).json({ success: false, error: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (Date.now() > stored.expiresAt) {
      delete sessionStore[normalizedPhone];
      return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new OTP.' });
    }

    const result = await call2FactorVerify(stored.sessionId, otp);

    if (!result.success) {
      stored.attempts += 1;
      return res.status(400).json({ success: false, error: result.error });
    }

    delete sessionStore[normalizedPhone];
    res.json({ success: true, message: 'Admin login successful', admin: true });

  } catch (err) {
    console.error('❌ ADMIN VERIFY OTP ERROR:', err);
    res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }
});

module.exports = router;