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

// ============================================================
// CRITICAL: Phone formatting for 2Factor API
// 2Factor expects: 91XXXXXXXXXX (no +, no leading 0)
// ============================================================
function formatPhoneFor2Factor(phone) {
  // Remove the + prefix
  let formatted = phone.replace('+', '');
  
  // If it starts with 0, remove it
  if (formatted.startsWith('0')) {
    formatted = formatted.substring(1);
  }
  
  // Ensure it has 91 prefix
  if (!formatted.startsWith('91')) {
    formatted = '91' + formatted;
  }
  
  return formatted;
}

// ============================================================
// COMPLETE DEBUGGING: SEND SMS OTP VIA 2FACTOR
// ============================================================
async function sendSmsOtp(phone, otp) {
  const startTime = Date.now();
  const requestId = crypto.randomBytes(8).toString('hex');
  
  console.log('\n');
  console.log('=================================================');
  console.log('📱 OTP REQUEST START');
  console.log('=================================================');
  console.log(`Request ID:     ${requestId}`);
  console.log(`Timestamp:      ${new Date().toISOString()}`);
  console.log(`Customer Phone: ${phone}`);
  console.log(`Generated OTP:  ${otp}`);
  console.log('=================================================');
  
  // ============================================================
  // STEP 1: CHECK ENVIRONMENT
  // ============================================================
  console.log('\n📋 ENVIRONMENT CHECK:');
  
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  console.log(`  Node Environment:  ${nodeEnv}`);
  console.log(`  TWO_FACTOR_API_KEY: ${apiKey ? '✅ PRESENT (length: ' + apiKey.length + ')' : '❌ MISSING'}`);
  console.log(`  API Key Format:    ${apiKey ? (apiKey.match(/^[A-Za-z0-9-]+$/) ? '✅ Valid format' : '⚠️ Contains special characters') : 'N/A'}`);
  
  if (!apiKey) {
    console.log('\n❌ CRITICAL: API Key is missing from environment variables!');
    console.log('=================================================\n');
    return { 
      success: false, 
      error: 'API_KEY_MISSING',
      details: 'TWO_FACTOR_API_KEY not set in environment variables'
    };
  }
  
  // ============================================================
  // STEP 2: FORMAT PHONE NUMBER
  // ============================================================
  console.log('\n📞 PHONE FORMATTING:');
  console.log(`  Original:         ${phone}`);
  
  const formattedPhone = formatPhoneFor2Factor(phone);
  console.log(`  Formatted:        ${formattedPhone}`);
  
  // Validate phone format
  const phoneValid = /^[0-9]{10,13}$/.test(formattedPhone);
  console.log(`  Phone Valid:      ${phoneValid ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!phoneValid) {
    console.log('❌ Invalid phone format for 2Factor');
    console.log('=================================================\n');
    return { 
      success: false, 
      error: 'INVALID_PHONE_FORMAT',
      details: `Phone format ${formattedPhone} is invalid for 2Factor`
    };
  }
  
  // ============================================================
  // STEP 3: BUILD REQUEST
  // ============================================================
  const templateName = 'OTP1'; // Default 2Factor template
  
  // 2Factor.in API endpoint
  const url = `https://2factor.in/API/V1/${apiKey}/SMS/${formattedPhone}/${otp}/${templateName}`;
  const maskedUrl = url.replace(apiKey, '***MASKED***');
  
  console.log('\n📤 REQUEST DETAILS:');
  console.log(`  HTTP Method:      GET`);
  console.log(`  Template Name:    ${templateName}`);
  console.log(`  Template Check:   ${templateName === 'OTP1' ? '✅ Using default template' : '⚠️ Custom template'}`);
  console.log(`  URL:              ${maskedUrl}`);
  console.log(`  Headers:          Content-Type: application/json`);
  console.log(`  Timeout:          30000ms`);
  
  // ============================================================
  // STEP 4: SEND REQUEST
  // ============================================================
  console.log('\n⏳ Sending request to 2Factor...');
  console.log(`  Request ID:       ${requestId}`);
  console.log(`  Start Time:       ${new Date().toISOString()}`);
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      },
      // This allows us to see the full request/response
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Accept all status codes for debugging
      }
    });
    
    const endTime = Date.now();
    const timeTaken = endTime - startTime;
    
    // ============================================================
    // STEP 5: PROCESS RESPONSE
    // ============================================================
    console.log('\n=================================================');
    console.log('📥 2FACTOR RESPONSE');
    console.log('=================================================');
    console.log(`  Request ID:       ${requestId}`);
    console.log(`  Status Code:      ${response.status}`);
    console.log(`  Status Text:      ${response.statusText || 'OK'}`);
    console.log(`  Time Taken:       ${timeTaken}ms`);
    console.log(`  Content-Type:     ${response.headers['content-type'] || 'unknown'}`);
    console.log('-------------------------------------------------');
    console.log('  RESPONSE BODY:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('-------------------------------------------------');
    
    // Check response status
    if (response.status === 200) {
      // 2Factor returns Status: "Success" or error details
      const status = response.data.Status;
      const details = response.data.Details || response.data.Message || 'No details provided';
      
      console.log('\n🔍 RESPONSE ANALYSIS:');
      console.log(`  Status Field:     ${status || 'MISSING'}`);
      console.log(`  Details:          ${details}`);
      
      if (status === 'Success') {
        console.log('\n✅ SUCCESS: Request accepted by 2Factor');
        console.log(`  OTP sent to:      ${formattedPhone}`);
        console.log(`  OTP:              ${otp}`);
        
        console.log('\n=================================================');
        console.log('✅ OTP REQUEST SUCCESSFULLY ACCEPTED');
        console.log('=================================================\n');
        
        return { 
          success: true, 
          data: response.data,
          requestId: requestId,
          message: 'OTP sent successfully via SMS'
        };
      } else {
        console.log('\n❌ FAILED: Request rejected by 2Factor');
        console.log(`  Reason:           ${details}`);
        console.log(`  Status:           ${status || 'UNKNOWN'}`);
        
        console.log('\n=================================================');
        console.log('❌ REQUEST REJECTED BY 2FACTOR');
        console.log(`   Reason: ${details}`);
        console.log('=================================================\n');
        
        return { 
          success: false, 
          error: details,
          status: status,
          details: response.data
        };
      }
    } else {
      // Non-200 response
      console.log('\n❌ HTTP ERROR: Non-200 response');
      console.log(`  Status:           ${response.status}`);
      console.log(`  Body:             ${JSON.stringify(response.data)}`);
      
      console.log('\n=================================================');
      console.log('❌ REQUEST FAILED WITH HTTP ERROR');
      console.log(`   Status: ${response.status}`);
      console.log('=================================================\n');
      
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
        details: response.data
      };
    }
    
  } catch (err) {
    const endTime = Date.now();
    const timeTaken = endTime - startTime;
    
    // ============================================================
    // STEP 6: PROCESS ERROR
    // ============================================================
    console.log('\n=================================================');
    console.log('❌ 2FACTOR ERROR');
    console.log('=================================================');
    console.log(`  Request ID:       ${requestId}`);
    console.log(`  Time Taken:       ${timeTaken}ms`);
    
    // Determine error type
    if (err.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(`  Error Type:       HTTP RESPONSE`);
      console.log(`  Status Code:      ${err.response.status}`);
      console.log(`  Status Text:      ${err.response.statusText || 'Unknown'}`);
      console.log('  Response Headers:');
      console.log(JSON.stringify(err.response.headers, null, 2));
      console.log('  Response Body:');
      console.log(JSON.stringify(err.response.data, null, 2));
      
      // Check for specific error codes
      if (err.response.status === 401) {
        console.log('\n🔑 AUTHENTICATION FAILED: Invalid API Key');
        console.log('  Your 2Factor API key may be invalid or expired.');
        console.log('  Please check your TWO_FACTOR_API_KEY environment variable.');
      } else if (err.response.status === 403) {
        console.log('\n🚫 FORBIDDEN: Access denied');
        console.log('  Your 2Factor account may not have SMS permissions.');
      } else if (err.response.status === 404) {
        console.log('\n🔍 NOT FOUND: Invalid endpoint');
        console.log('  The API endpoint may have changed.');
        console.log('  Check the 2Factor API documentation.');
      } else if (err.response.status === 429) {
        console.log('\n⏰ RATE LIMITED: Too many requests');
        console.log('  Please wait before trying again.');
      } else if (err.response.status >= 500) {
        console.log('\n💥 SERVER ERROR: 2Factor service issue');
        console.log('  Try again later.');
      }
      
      console.log('\n=================================================');
      console.log('❌ REQUEST FAILED - SERVER RESPONDED WITH ERROR');
      console.log(`   Status: ${err.response.status}`);
      console.log(`   Message: ${err.response.data?.Details || err.response.statusText}`);
      console.log('=================================================\n');
      
      return { 
        success: false, 
        error: err.response.data?.Details || err.response.statusText,
        statusCode: err.response.status,
        details: err.response.data,
        type: 'HTTP_RESPONSE'
      };
      
    } else if (err.request) {
      // The request was made but no response was received
      console.log(`  Error Type:       NETWORK ERROR`);
      console.log(`  Error Code:       ${err.code || 'UNKNOWN'}`);
      console.log(`  Error Message:    ${err.message}`);
      
      // Detect specific network errors
      if (err.code === 'ECONNREFUSED') {
        console.log('\n🔌 CONNECTION REFUSED: 2Factor server not reachable');
        console.log('  Check if the 2Factor API endpoint is correct.');
        console.log('  Your server may need to allow outbound HTTPS connections.');
      } else if (err.code === 'ENOTFOUND') {
        console.log('\n🌐 DNS ERROR: Cannot resolve 2factor.in');
        console.log('  DNS resolution failed. Check your DNS settings.');
        console.log('  Render might need custom DNS configuration.');
      } else if (err.code === 'ETIMEDOUT') {
        console.log('\n⏰ REQUEST TIMEOUT: 2Factor did not respond in time');
        console.log('  The 2Factor API may be slow or unavailable.');
      } else if (err.code === 'ECONNRESET') {
        console.log('\n🔌 CONNECTION RESET: Connection was interrupted');
        console.log('  This could be a network issue or a firewall blocking the request.');
      } else if (err.code === 'CERT_HAS_EXPIRED') {
        console.log('\n🔐 SSL CERTIFICATE ERROR: 2Factor SSL certificate expired');
        console.log('  This is a 2Factor issue. Contact their support.');
      } else if (err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        console.log('\n🔐 SSL VERIFICATION FAILED');
        console.log('  SSL certificate verification failed.');
        console.log('  You may need to add `rejectUnauthorized: false` in development.');
      }
      
      console.log('\n=================================================');
      console.log('❌ REQUEST FAILED - NO RESPONSE FROM 2FACTOR');
      console.log(`   Error: ${err.code || err.message}`);
      console.log('=================================================\n');
      
      return { 
        success: false, 
        error: err.message,
        code: err.code,
        type: 'NETWORK_ERROR'
      };
      
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log(`  Error Type:       REQUEST SETUP ERROR`);
      console.log(`  Error Message:    ${err.message}`);
      console.log(`  Stack Trace:`);
      console.log(err.stack);
      
      console.log('\n=================================================');
      console.log('❌ REQUEST FAILED - SETUP ERROR');
      console.log(`   Error: ${err.message}`);
      console.log('=================================================\n');
      
      return { 
        success: false, 
        error: err.message,
        type: 'SETUP_ERROR',
        details: err.stack
      };
    }
  }
}

// ============================================================
// SEND OTP FOR USER LOGIN
// ============================================================
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    
    console.log('\n=================================================');
    console.log('🚀 OTP API REQUEST RECEIVED');
    console.log('=================================================');
    console.log(`  Timestamp:        ${new Date().toISOString()}`);
    console.log(`  IP Address:       ${req.ip || req.connection.remoteAddress}`);
    console.log(`  User Agent:       ${req.headers['user-agent'] || 'Unknown'}`);
    console.log(`  Request Body:     ${JSON.stringify(req.body)}`);
    console.log('=================================================\n');
    
    // Validate phone
    if (!phone || phone.length < 10) {
      console.log('❌ Invalid phone number received');
      return res.status(400).json({ error: 'Valid phone number required' });
    }
    
    // Normalize phone
    const normalizedPhone = normalizePhone(phone);
    console.log(`📱 Phone normalized: ${normalizedPhone}`);
    
    // Generate OTP
    const otp = generateOtp();
    console.log(`🔢 OTP generated: ${otp}`);
    
    // Store OTP with expiry (10 minutes)
    otpStore[normalizedPhone] = {
      otp: otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      createdAt: new Date().toISOString()
    };
    console.log(`💾 OTP stored for ${normalizedPhone}, expires at ${new Date(otpStore[normalizedPhone].expiresAt).toISOString()}`);
    
    // Send SMS via 2Factor with full debugging
    const result = await sendSmsOtp(normalizedPhone, otp);
    
    // ============================================================
    // FINAL RESULT
    // ============================================================
    console.log('\n=================================================');
    console.log('📋 FINAL OTP RESULT');
    console.log('=================================================');
    
    if (result.success) {
      console.log('✅ OTP REQUEST SUCCESSFULLY ACCEPTED');
      console.log(`   OTP: ${otp}`);
      console.log(`   Phone: ${normalizedPhone}`);
      console.log(`   Request ID: ${result.requestId || 'N/A'}`);
      console.log('=================================================\n');
      
      res.json({ 
        message: 'OTP sent successfully via SMS',
        otp: otp,
        smsFailed: false,
        requestId: result.requestId
      });
    } else {
      console.log('❌ OTP REQUEST FAILED');
      console.log(`   Reason: ${result.error}`);
      console.log(`   Type: ${result.type || 'UNKNOWN'}`);
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details)}`);
      }
      console.log('=================================================\n');
      
      // Still return OTP for debugging
      res.json({ 
        message: 'OTP generated. SMS delivery failed. Check Render logs for details.',
        otp: otp,
        smsFailed: true,
        error: result.error,
        type: result.type,
        details: result.details
      });
    }
    
  } catch (err) {
    console.error('\n❌ UNHANDLED ERROR IN OTP ROUTE:');
    console.error(err);
    console.error('=================================================\n');
    
    res.status(500).json({ 
      error: 'Server error: ' + err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// ============================================================
// VERIFY OTP
// ============================================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    console.log('\n=================================================');
    console.log('🔐 OTP VERIFY REQUEST RECEIVED');
    console.log('=================================================');
    console.log(`  Timestamp:        ${new Date().toISOString()}`);
    console.log(`  Phone:            ${phone}`);
    console.log(`  OTP Provided:     ${otp}`);
    console.log('=================================================\n');
    
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP required' });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const stored = otpStore[normalizedPhone];
    
    if (!stored) {
      console.log('❌ No OTP found for:', normalizedPhone);
      return res.status(400).json({ error: 'No OTP found. Please request a new OTP.' });
    }
    
    console.log(`  Stored OTP:       ${stored.otp}`);
    console.log(`  Attempts:         ${stored.attempts}/5`);
    console.log(`  Expires At:       ${new Date(stored.expiresAt).toISOString()}`);
    console.log(`  Time Remaining:   ${Math.max(0, Math.floor((stored.expiresAt - Date.now()) / 1000))}s`);
    
    if (stored.attempts >= 5) {
      delete otpStore[normalizedPhone];
      console.log('❌ Too many failed attempts, OTP cleared');
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }
    
    if (Date.now() > stored.expiresAt) {
      delete otpStore[normalizedPhone];
      console.log('❌ OTP expired');
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
    
    // OTP verified successfully
    console.log('✅ OTP verified successfully');
    delete otpStore[normalizedPhone];
    console.log('=================================================\n');
    
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
    
    const result = await sendSmsOtp(normalizedPhone, otp);
    
    if (!result.success) {
      return res.json({ 
        message: 'OTP generated. SMS delivery failed. Check console logs.',
        otp: otp,
        smsFailed: true,
        error: result.error,
        type: result.type
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

// ============================================================
// DEBUG ROUTE: Check OTP status
// ============================================================
router.get('/status/:phone', (req, res) => {
  const phone = req.params.phone;
  const normalized = normalizePhone(phone);
  const stored = otpStore[normalized];
  
  if (!stored) {
    return res.json({ exists: false, message: 'No OTP found' });
  }
  
  res.json({
    exists: true,
    phone: normalized,
    otp: stored.otp,
    attempts: stored.attempts,
    expiresAt: new Date(stored.expiresAt).toISOString(),
    timeRemaining: Math.max(0, Math.floor((stored.expiresAt - Date.now()) / 1000)),
    isExpired: Date.now() > stored.expiresAt
  });
});

module.exports = router;