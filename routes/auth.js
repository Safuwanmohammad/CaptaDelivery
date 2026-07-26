const express = require('express');
const router = express.Router();
const pool = require('../db');
const axios = require('axios');

// In-memory session store (use Redis in production)
// Stores: { phone: { sessionId, expiresAt, attempts } }
const sessionStore = {};

// ============================================================
// HELPERS
// ============================================================

function normalizePhone(phone) {
  if (!phone) return '';
  // Remove all spaces and dashes
  let cleaned = phone.replace(/[\s\-]/g, '');
  // Remove any non-digit characters except +
  cleaned = cleaned.replace(/[^0-9+]/g, '');
  
  // If it doesn't start with +, add +91
  if (!cleaned.startsWith('+')) {
    // If it starts with 0, remove the 0
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = '+91' + cleaned;
  }
  return cleaned;
}

// 2Factor expects: 91XXXXXXXXXX (no +, no leading 0)
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
// SEND OTP USING 2FACTOR AUTOGEN API
// ============================================================
async function sendOtpViaAutogen(phone, templateName = 'OTP1') {
  const startTime = Date.now();
  
  console.log('\n========== OTP REQUEST ==========');
  console.log(`Phone:           ${phone}`);
  console.log(`Template:        ${templateName}`);
  
  // Check API Key
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  console.log(`API Key Loaded:  ${apiKey ? 'YES' : 'NO'}`);
  
  if (!apiKey) {
    console.error('❌ TWO_FACTOR_API_KEY is not set');
    console.log('==========================================\n');
    return { 
      success: false, 
      error: 'API_KEY_MISSING',
      statusCode: 500
    };
  }
  
  // Format phone for 2Factor
  const formattedPhone = formatPhoneFor2Factor(phone);
  console.log(`Formatted Phone: ${formattedPhone}`);
  
  // Build AUTOGEN endpoint
  // GET https://2factor.in/API/V1/{API_KEY}/SMS/{PHONE}/AUTOGEN/{TEMPLATE_NAME}
  const url = `https://2factor.in/API/V1/${apiKey}/SMS/${formattedPhone}/AUTOGEN/${templateName}`;
  const maskedUrl = url.replace(apiKey, '***MASKED***');
  
  console.log(`Endpoint:        ${maskedUrl}`);
  console.log('==========================================');
  console.log('⏳ Sending AUTOGEN request to 2Factor...');
  
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
    
    console.log('\n========== 2FACTOR RESPONSE ==========');
    console.log(`Status Code:     ${response.status}`);
    console.log(`Time Taken:      ${timeTaken}ms`);
    // Log response without exposing sensitive data
    console.log(`Response Status: ${response.data.Status || 'UNKNOWN'}`);
    console.log(`Session ID:      ${response.data.Details ? '✅ Received' : '❌ Not received'}`);
    console.log('==========================================');
    
    // Check if 2Factor accepted the request
    if (response.data.Status === 'Success') {
      const sessionId = response.data.Details;
      
      if (!sessionId) {
        console.error('❌ No session ID returned from 2Factor');
        return { 
          success: false, 
          error: 'NO_SESSION_ID',
          statusCode: 500
        };
      }
      
      console.log(`\n✅ OTP AUTOGEN successful`);
      console.log(`   Session ID: ${sessionId.substring(0, 8)}...`);
      console.log(`   OTP sent to: ${formattedPhone}`);
      console.log('==========================================\n');
      
      return { 
        success: true, 
        sessionId: sessionId,
        data: response.data,
        statusCode: 200
      };
    } else {
      // 2Factor rejected the request
      const errorMessage = response.data.Details || response.data.Message || 'Unknown error';
      console.log(`\n❌ OTP request rejected by 2Factor`);
      console.log(`   Reason: ${errorMessage}`);
      console.log('==========================================\n');
      
      return { 
        success: false, 
        error: errorMessage,
        statusCode: 400,
        details: response.data
      };
    }
  } catch (err) {
    const timeTaken = Date.now() - startTime;
    
    console.log('\n========== OTP ERROR ==========');
    console.log(`Time Taken:      ${timeTaken}ms`);
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (err.response) {
      // The request was made and the server responded with an error status
      statusCode = err.response.status;
      errorMessage = err.response.data?.Details || err.response.statusText || '2Factor API error';
      
      console.log(`Status Code:     ${statusCode}`);
      console.log(`Error:           ${errorMessage}`);
      
      if (statusCode === 401) {
        console.log('\n🔑 AUTHENTICATION FAILED: Invalid 2Factor API Key');
        console.log('   Please verify your TWO_FACTOR_API_KEY is correct.');
      } else if (statusCode === 403) {
        console.log('\n🚫 FORBIDDEN: Access denied');
        console.log('   Your 2Factor account may not have SMS permissions.');
      } else if (statusCode === 404) {
        console.log('\n🔍 NOT FOUND: Invalid endpoint or template');
        console.log('   Check if the AUTOGEN endpoint and template name are correct.');
      } else if (statusCode === 429) {
        console.log('\n⏰ RATE LIMITED: Too many requests');
        console.log('   Please wait before trying again.');
      }
    } else if (err.request) {
      // The request was made but no response was received
      statusCode = 503;
      errorMessage = err.code || 'NETWORK_ERROR';
      
      console.log(`Network Error:   ${err.code || 'UNKNOWN'}`);
      console.log(`Message:         ${err.message}`);
      
      if (err.code === 'ENOTFOUND') {
        console.log('\n🌐 DNS ERROR: Cannot resolve 2factor.in');
      } else if (err.code === 'ETIMEDOUT') {
        console.log('\n⏰ REQUEST TIMEOUT: 2Factor did not respond');
      } else if (err.code === 'ECONNREFUSED') {
        console.log('\n🔌 CONNECTION REFUSED: 2Factor server unreachable');
      }
    } else {
      // Something else went wrong
      errorMessage = err.message;
      console.log(`Error:           ${errorMessage}`);
      if (err.stack) {
        console.log(`Stack Trace:     ${err.stack}`);
      }
    }
    
    console.log('==========================================\n');
    
    return { 
      success: false, 
      error: errorMessage,
      statusCode: statusCode
    };
  }
}

// ============================================================
// VERIFY OTP USING 2FACTOR VERIFY API
// ============================================================
async function verifyOtpWith2Factor(sessionId, otp) {
  const startTime = Date.now();
  
  console.log('\n========== OTP VERIFY REQUEST ==========');
  console.log(`Session ID:      ${sessionId.substring(0, 8)}...`);
  console.log(`OTP:             ${otp ? '✅ Provided' : '❌ Missing'}`);
  
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  console.log(`API Key Loaded:  ${apiKey ? 'YES' : 'NO'}`);
  
  if (!apiKey) {
    console.error('❌ TWO_FACTOR_API_KEY is not set');
    console.log('==========================================\n');
    return { 
      success: false, 
      error: 'API_KEY_MISSING',
      statusCode: 500
    };
  }
  
  // Build verify endpoint
  // GET https://2factor.in/API/V1/{API_KEY}/SMS/VERIFY/{SESSION_ID}/{OTP}
  const url = `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${sessionId}/${otp}`;
  const maskedUrl = url.replace(apiKey, '***MASKED***');
  
  console.log(`Endpoint:        ${maskedUrl}`);
  console.log('==========================================');
  console.log('⏳ Sending verify request to 2Factor...');
  
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
    
    console.log('\n========== 2FACTOR VERIFY RESPONSE ==========');
    console.log(`Status Code:     ${response.status}`);
    console.log(`Time Taken:      ${timeTaken}ms`);
    console.log(`Response Status: ${response.data.Status || 'UNKNOWN'}`);
    console.log('==========================================');
    
    // Check verification result
    if (response.data.Status === 'Success') {
      console.log(`\n✅ OTP verified successfully`);
      console.log('==========================================\n');
      return { 
        success: true, 
        data: response.data,
        statusCode: 200
      };
    } else {
      // OTP verification failed
      const errorMessage = response.data.Details || response.data.Message || 'Invalid OTP';
      console.log(`\n❌ OTP verification failed`);
      console.log(`   Reason: ${errorMessage}`);
      console.log('==========================================\n');
      
      return { 
        success: false, 
        error: errorMessage,
        statusCode: 400,
        details: response.data
      };
    }
  } catch (err) {
    const timeTaken = Date.now() - startTime;
    
    console.log('\n========== VERIFY ERROR ==========');
    console.log(`Time Taken:      ${timeTaken}ms`);
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (err.response) {
      statusCode = err.response.status;
      errorMessage = err.response.data?.Details || err.response.statusText || 'Verification failed';
      console.log(`Status Code:     ${statusCode}`);
      console.log(`Error:           ${errorMessage}`);
      
      if (statusCode === 401) {
        console.log('\n🔑 AUTHENTICATION FAILED: Invalid API Key');
      } else if (statusCode === 404) {
        console.log('\n🔍 SESSION NOT FOUND: Invalid or expired session');
      }
    } else if (err.request) {
      statusCode = 503;
      errorMessage = err.code || 'NETWORK_ERROR';
      console.log(`Network Error:   ${err.code || 'UNKNOWN'}`);
      console.log(`Message:         ${err.message}`);
    } else {
      errorMessage = err.message;
      console.log(`Error:           ${errorMessage}`);
    }
    
    console.log('==========================================\n');
    
    return { 
      success: false, 
      error: errorMessage,
      statusCode: statusCode
    };
  }
}

// ============================================================
// SEND OTP - MAIN ROUTE
// ============================================================
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    
    console.log('\n=================================================');
    console.log('📱 OTP REQUEST RECEIVED');
    console.log('=================================================');
    console.log(`  Timestamp:        ${new Date().toISOString()}`);
    console.log(`  Phone:            ${phone ? '✅ Received' : '❌ Missing'}`);
    console.log('=================================================');
    
    // Validate phone number
    if (!phone || phone.length < 10) {
      console.log('❌ Invalid phone number');
      return res.status(400).json({ 
        success: false,
        error: 'Valid phone number required' 
      });
    }
    
    // Normalize phone number
    const normalizedPhone = normalizePhone(phone);
    console.log(`📱 Normalized:     ${normalizedPhone}`);
    
    // Check if user is blocked (optional - implement if needed)
    // const userCheck = await pool.query('SELECT blocked FROM users WHERE phone = $1', [normalizedPhone]);
    // if (userCheck.rows.length > 0 && userCheck.rows[0].blocked) {
    //   return res.status(403).json({ success: false, error: 'Account is blocked' });
    // }
    
    // ============================================================
    // CRITICAL: Send OTP using 2Factor AUTOGEN API
    // ============================================================
    console.log('\n📤 Sending AUTOGEN request to 2Factor...');
    const result = await sendOtpViaAutogen(normalizedPhone, 'OTP1');
    
    // ============================================================
    // Handle response
    // ============================================================
    if (result.success) {
      // Store session ID with expiry
      sessionStore[normalizedPhone] = {
        sessionId: result.sessionId,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        attempts: 0,
        createdAt: new Date().toISOString()
      };
      
      console.log(`💾 Session stored for ${normalizedPhone}`);
      console.log(`   Session ID: ${result.sessionId.substring(0, 8)}...`);
      console.log(`   Expires at: ${new Date(Date.now() + 10 * 60 * 1000).toISOString()}`);
      
      console.log('\n✅ OTP sent successfully via 2Factor AUTOGEN');
      console.log('=================================================\n');
      
      // Return success WITHOUT exposing OTP
      res.json({
        success: true,
        message: 'OTP sent successfully to your phone'
      });
    } else {
      console.log('\n❌ Failed to send OTP');
      console.log(`   Error: ${result.error}`);
      console.log('=================================================\n');
      
      const statusCode = result.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: 'Failed to send OTP. Please try again.',
        error: result.error
      });
    }
  } catch (err) {
    console.error('\n❌ UNHANDLED ERROR in /send-otp:');
    console.error(err);
    console.log('=================================================\n');
    
    res.status(500).json({
      success: false,
      error: 'Server error. Please try again later.'
    });
  }
});

// ============================================================
// VERIFY OTP - MAIN ROUTE
// ============================================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    console.log('\n=================================================');
    console.log('🔐 OTP VERIFY REQUEST');
    console.log('=================================================');
    console.log(`  Timestamp:        ${new Date().toISOString()}`);
    console.log(`  Phone:            ${phone ? '✅ Received' : '❌ Missing'}`);
    console.log(`  OTP:              ${otp ? '✅ Received' : '❌ Missing'}`);
    console.log('=================================================');
    
    // Validate inputs
    if (!phone || phone.length < 10) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid phone number required' 
      });
    }
    
    if (!otp || otp.length < 4) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid OTP required' 
      });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const stored = sessionStore[normalizedPhone];
    
    // Check if session exists
    if (!stored) {
      console.log('❌ No session found for this phone');
      return res.status(400).json({ 
        success: false,
        error: 'No OTP requested. Please request a new OTP.' 
      });
    }
    
    console.log(`  Session ID:       ${stored.sessionId.substring(0, 8)}...`);
    console.log(`  Attempts:         ${stored.attempts}/5`);
    console.log(`  Expires At:       ${new Date(stored.expiresAt).toISOString()}`);
    console.log(`  Time Remaining:   ${Math.max(0, Math.floor((stored.expiresAt - Date.now()) / 1000))}s`);
    
    // Check attempts
    if (stored.attempts >= 5) {
      delete sessionStore[normalizedPhone];
      console.log('❌ Too many failed attempts, session cleared');
      return res.status(400).json({ 
        success: false,
        error: 'Too many failed attempts. Please request a new OTP.' 
      });
    }
    
    // Check expiry
    if (Date.now() > stored.expiresAt) {
      delete sessionStore[normalizedPhone];
      console.log('❌ Session expired');
      return res.status(400).json({ 
        success: false,
        error: 'OTP has expired. Please request a new OTP.' 
      });
    }
    
    // ============================================================
    // CRITICAL: Verify OTP using 2Factor Verify API
    // ============================================================
    console.log('\n📤 Sending verify request to 2Factor...');
    const result = await verifyOtpWith2Factor(stored.sessionId, otp);
    
    // ============================================================
    // Handle verification result
    // ============================================================
    if (result.success) {
      console.log('✅ OTP verified successfully');
      // Clear session on success
      delete sessionStore[normalizedPhone];
      console.log('🗑️  Session cleared');
      console.log('=================================================\n');
      
      // Check if user exists
      const userResult = await pool.query('SELECT * FROM users WHERE phone = $1', [normalizedPhone]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'No account found. Please sign up.' 
        });
      }
      
      // Update user login info (optional)
      await pool.query(
        'UPDATE users SET last_login = NOW() WHERE phone = $1',
        [normalizedPhone]
      );
      
      res.json({ 
        success: true,
        message: 'Login successful', 
        user: userResult.rows[0] 
      });
    } else {
      // Verification failed
      stored.attempts += 1;
      console.log(`❌ OTP verification failed. Attempts remaining: ${5 - stored.attempts}`);
      console.log(`   Error: ${result.error}`);
      console.log('=================================================\n');
      
      const statusCode = result.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        attemptsRemaining: 5 - stored.attempts
      });
    }
  } catch (err) {
    console.error('\n❌ UNHANDLED ERROR in /verify-otp:');
    console.error(err);
    console.log('=================================================\n');
    
    res.status(500).json({
      success: false,
      error: 'Server error. Please try again.'
    });
  }
});

// ============================================================
// REGISTER NEW USER
// ============================================================
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, address, pincode, phone, otp } = req.body;
    
    console.log('\n=================================================');
    console.log('📝 REGISTER REQUEST');
    console.log('=================================================');
    console.log(`  Phone:            ${phone ? '✅ Received' : '❌ Missing'}`);
    console.log(`  OTP:              ${otp ? '✅ Received' : '❌ Missing'}`);
    console.log('=================================================');
    
    // Validate all fields
    if (!firstName || !lastName || !address || !pincode || !phone || !otp) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required' 
      });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const stored = sessionStore[normalizedPhone];
    
    // Check if session exists
    if (!stored) {
      console.log('❌ No session found for registration');
      return res.status(400).json({ 
        success: false,
        error: 'No OTP requested. Please request a new OTP.' 
      });
    }
    
    console.log(`  Session ID:       ${stored.sessionId.substring(0, 8)}...`);
    console.log(`  Attempts:         ${stored.attempts}/5`);
    
    // Check attempts
    if (stored.attempts >= 5) {
      delete sessionStore[normalizedPhone];
      return res.status(400).json({ 
        success: false,
        error: 'Too many failed attempts. Please request a new OTP.' 
      });
    }
    
    // Check expiry
    if (Date.now() > stored.expiresAt) {
      delete sessionStore[normalizedPhone];
      return res.status(400).json({ 
        success: false,
        error: 'OTP has expired. Please request a new OTP.' 
      });
    }
    
    // ============================================================
    // Verify OTP using 2Factor Verify API
    // ============================================================
    console.log('\n📤 Verifying OTP for registration...');
    const result = await verifyOtpWith2Factor(stored.sessionId, otp);
    
    if (!result.success) {
      stored.attempts += 1;
      console.log(`❌ OTP verification failed. Attempts remaining: ${5 - stored.attempts}`);
      return res.status(400).json({
        success: false,
        error: result.error,
        attemptsRemaining: 5 - stored.attempts
      });
    }
    
    // OTP verified successfully
    console.log('✅ OTP verified for registration');
    delete sessionStore[normalizedPhone];
    
    // Check if user already exists
    const existing = await pool.query('SELECT * FROM users WHERE phone = $1', [normalizedPhone]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'User already exists. Please login.' 
      });
    }
    
    // Create new user
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
    console.error('\n❌ UNHANDLED ERROR in /register:');
    console.error(err);
    console.log('=================================================\n');
    
    res.status(500).json({ 
      success: false,
      error: 'Server error. Please try again.' 
    });
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
      return res.status(400).json({ 
        success: false,
        error: 'Valid phone number required' 
      });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const adminPhones = await getAdminPhones();
    const isAdmin = adminPhones.some(p => p === normalizedPhone);
    
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized as admin' 
      });
    }
    
    console.log(`📱 Admin OTP request for ${normalizedPhone}`);
    
    const result = await sendOtpViaAutogen(normalizedPhone, 'OTP1');
    
    if (!result.success) {
      return res.status(result.statusCode || 500).json({
        success: false,
        error: result.error
      });
    }
    
    // Store session ID
    sessionStore[normalizedPhone] = {
      sessionId: result.sessionId,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      createdAt: new Date().toISOString(),
      isAdmin: true
    };
    
    res.json({ 
      success: true,
      message: 'Admin OTP sent successfully' 
    });
  } catch (err) {
    console.error('Admin send OTP error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error. Please try again.' 
    });
  }
});

router.post('/admin/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({ 
        success: false,
        error: 'Phone and OTP required' 
      });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const adminPhones = await getAdminPhones();
    const isAdmin = adminPhones.some(p => p === normalizedPhone);
    
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized as admin' 
      });
    }
    
    const stored = sessionStore[normalizedPhone];
    
    if (!stored) {
      return res.status(400).json({ 
        success: false,
        error: 'No OTP requested. Please request a new OTP.' 
      });
    }
    
    if (stored.attempts >= 5) {
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
    
    const result = await verifyOtpWith2Factor(stored.sessionId, otp);
    
    if (!result.success) {
      stored.attempts += 1;
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    delete sessionStore[normalizedPhone];
    res.json({ 
      success: true,
      message: 'Admin login successful', 
      admin: true 
    });
  } catch (err) {
    console.error('Admin verify OTP error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error. Please try again.' 
    });
  }
});

// ============================================================
// SESSION STATUS - DEBUG ROUTE (Optional)
// ============================================================
router.get('/session-status/:phone', (req, res) => {
  const phone = req.params.phone;
  const normalized = normalizePhone(phone);
  const stored = sessionStore[normalized];
  
  if (!stored) {
    return res.json({ 
      exists: false, 
      message: 'No session found' 
    });
  }
  
  res.json({
    exists: true,
    phone: normalized,
    sessionId: stored.sessionId.substring(0, 8) + '...',
    attempts: stored.attempts,
    expiresAt: new Date(stored.expiresAt).toISOString(),
    timeRemaining: Math.max(0, Math.floor((stored.expiresAt - Date.now()) / 1000)),
    isExpired: Date.now() > stored.expiresAt
  });
});

module.exports = router;