const express = require('express');
const router = express.Router();
const pool = require('../db');
const axios = require('axios');

// ============================================================
// CONFIGURATION
// ============================================================
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const TWO_FACTOR_BASE_URL = 'https://2factor.in/API/V1';

// ============================================================
// IN-MEMORY SESSION STORE
// Note: For production, use Redis or another distributed cache
// ============================================================
const sessionStore = new Map();

// ============================================================
// HELPERS
// ============================================================

/**
 * Normalize phone number to E.164 format
 * Input: 9483685462, 919483685462, +919483685462
 * Output: +919483685462
 */
function normalizePhone(phone) {
  if (!phone) return '';
  
  // Remove spaces, dashes, and special characters
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  // Keep only digits and plus sign
  cleaned = cleaned.replace(/[^0-9+]/g, '');
  
  // If no country code, assume India (+91)
  if (!cleaned.startsWith('+')) {
    // Remove leading zero if present
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = '+91' + cleaned;
  }
  
  return cleaned;
}

/**
 * Format phone for 2Factor API
 * Input: +919483685462
 * Output: 919483685462
 */
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

/**
 * Validate phone number
 */
function isValidPhone(phone) {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  // Must be at least 10 digits after normalization
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Get 2Factor API key from environment
 */
function getApiKey() {
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  if (!apiKey) {
    console.error('❌ TWO_FACTOR_API_KEY environment variable is not set');
    return null;
  }
  return apiKey;
}

/**
 * Create structured log entry
 */
function logEvent(level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  };
  
  // Remove sensitive data from logs
  delete logEntry.apiKey;
  delete logEntry.otp;
  delete logEntry.sessionId;
  
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

// ============================================================
// 2FACTOR API FUNCTIONS
// ============================================================

/**
 * Send OTP using 2Factor AUTOGEN API
 */
async function sendOtpViaAutogen(phone, templateName = 'OTP1') {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { 
      success: false, 
      error: 'API_KEY_MISSING',
      statusCode: 500
    };
  }
  
  const formattedPhone = formatPhoneFor2Factor(phone);
  const url = `${TWO_FACTOR_BASE_URL}/${apiKey}/SMS/${formattedPhone}/AUTOGEN/${templateName}`;
  
  logEvent('info', 'Sending AUTOGEN request to 2Factor', {
    phone: formattedPhone,
    template: templateName
  });
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    logEvent('info', '2Factor AUTOGEN response received', {
      status: response.status,
      responseStatus: response.data?.Status
    });
    
    if (response.data?.Status === 'Success') {
      const sessionId = response.data.Details;
      
      if (!sessionId) {
        logEvent('error', 'No session ID returned from 2Factor', {
          response: response.data
        });
        return { 
          success: false, 
          error: 'NO_SESSION_ID',
          statusCode: 500
        };
      }
      
      return { 
        success: true, 
        sessionId: sessionId,
        data: response.data,
        statusCode: 200
      };
    } else {
      const errorMessage = response.data?.Details || response.data?.Message || 'Unknown error';
      logEvent('error', '2Factor rejected AUTOGEN request', {
        error: errorMessage,
        response: response.data
      });
      
      return { 
        success: false, 
        error: errorMessage,
        statusCode: 400,
        details: response.data
      };
    }
  } catch (err) {
    logEvent('error', '2Factor AUTOGEN request failed', {
      error: err.message,
      code: err.code,
      status: err.response?.status
    });
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (err.response) {
      statusCode = err.response.status;
      errorMessage = err.response.data?.Details || err.response.statusText || '2Factor API error';
    } else if (err.request) {
      statusCode = 503;
      errorMessage = err.code || 'NETWORK_ERROR';
    } else {
      errorMessage = err.message;
    }
    
    return { 
      success: false, 
      error: errorMessage,
      statusCode: statusCode
    };
  }
}

/**
 * Verify OTP using 2Factor Verify API
 */
async function verifyOtpWith2Factor(sessionId, otp) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { 
      success: false, 
      error: 'API_KEY_MISSING',
      statusCode: 500
    };
  }
  
  const url = `${TWO_FACTOR_BASE_URL}/${apiKey}/SMS/VERIFY/${sessionId}/${otp}`;
  
  logEvent('info', 'Sending verify request to 2Factor', {
    sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null
  });
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    logEvent('info', '2Factor verify response received', {
      status: response.status,
      responseStatus: response.data?.Status
    });
    
    if (response.data?.Status === 'Success') {
      return { 
        success: true, 
        data: response.data,
        statusCode: 200
      };
    } else {
      const errorMessage = response.data?.Details || response.data?.Message || 'Invalid OTP';
      logEvent('error', '2Factor verify rejected', {
        error: errorMessage
      });
      
      return { 
        success: false, 
        error: errorMessage,
        statusCode: 400,
        details: response.data
      };
    }
  } catch (err) {
    logEvent('error', '2Factor verify request failed', {
      error: err.message,
      code: err.code,
      status: err.response?.status
    });
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (err.response) {
      statusCode = err.response.status;
      errorMessage = err.response.data?.Details || err.response.statusText || 'Verification failed';
    } else if (err.request) {
      statusCode = 503;
      errorMessage = err.code || 'NETWORK_ERROR';
    } else {
      errorMessage = err.message;
    }
    
    return { 
      success: false, 
      error: errorMessage,
      statusCode: statusCode
    };
  }
}

// ============================================================
// CLEANUP EXPIRED SESSIONS
// ============================================================
function cleanupSessions() {
  const now = Date.now();
  let count = 0;
  
  for (const [key, value] of sessionStore.entries()) {
    if (value.expiresAt < now) {
      sessionStore.delete(key);
      count++;
    }
  }
  
  if (count > 0) {
    logEvent('info', `Cleaned up ${count} expired sessions`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupSessions, 5 * 60 * 1000);

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /send-otp
 * Request: { phone: string }
 * Response: { success: boolean, message: string }
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    
    logEvent('info', 'OTP request received', {
      phoneProvided: !!phone
    });
    
    // Validate phone
    if (!phone || !isValidPhone(phone)) {
      logEvent('warn', 'Invalid phone number received');
      return res.status(400).json({ 
        success: false,
        error: 'Valid phone number required' 
      });
    }
    
    const normalizedPhone = normalizePhone(phone);
    
    // Check if user is blocked
    const userCheck = await pool.query(
      'SELECT blocked FROM users WHERE phone = $1',
      [normalizedPhone]
    );
    
    if (userCheck.rows.length > 0 && userCheck.rows[0].blocked) {
      logEvent('warn', 'Blocked user attempted OTP', {
        phone: normalizedPhone
      });
      return res.status(403).json({ 
        success: false,
        error: 'Account is blocked. Contact support.' 
      });
    }
    
    // Check for existing session
    const existingSession = sessionStore.get(normalizedPhone);
    if (existingSession) {
      const timeRemaining = Math.floor((existingSession.expiresAt - Date.now()) / 1000);
      if (timeRemaining > 60) {
        // Allow resend if more than 1 minute has passed
        logEvent('info', 'Existing session found', {
          phone: normalizedPhone,
          timeRemaining: timeRemaining
        });
      }
    }
    
    // Send OTP via 2Factor
    const result = await sendOtpViaAutogen(normalizedPhone, 'OTP1');
    
    if (result.success) {
      // Store session
      sessionStore.set(normalizedPhone, {
        sessionId: result.sessionId,
        expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
        attempts: 0,
        createdAt: Date.now()
      });
      
      logEvent('info', 'OTP sent successfully', {
        phone: normalizedPhone
      });
      
      return res.json({
        success: true,
        message: 'OTP sent successfully to your phone'
      });
    } else {
      logEvent('error', 'Failed to send OTP', {
        phone: normalizedPhone,
        error: result.error
      });
      
      const statusCode = result.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: 'Failed to send OTP. Please try again.',
        error: result.error
      });
    }
  } catch (err) {
    logEvent('error', 'Unhandled error in send-otp', {
      error: err.message,
      stack: err.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Server error. Please try again later.'
    });
  }
});

/**
 * POST /verify-otp
 * Request: { phone: string, otp: string }
 * Response: { success: boolean, message: string, user?: object }
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    logEvent('info', 'OTP verify request received', {
      phoneProvided: !!phone,
      otpProvided: !!otp
    });
    
    // Validate inputs
    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid phone number required' 
      });
    }
    
    if (!otp || otp.length < 4 || otp.length > 6) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid OTP required' 
      });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const stored = sessionStore.get(normalizedPhone);
    
    // Check for existing session
    if (!stored) {
      logEvent('warn', 'No session found for OTP verification', {
        phone: normalizedPhone
      });
      return res.status(400).json({ 
        success: false,
        error: 'No OTP requested. Please request a new OTP.' 
      });
    }
    
    logEvent('info', 'Session found for verification', {
      phone: normalizedPhone,
      attempts: stored.attempts,
      maxAttempts: MAX_ATTEMPTS
    });
    
    // Check attempts
    if (stored.attempts >= MAX_ATTEMPTS) {
      sessionStore.delete(normalizedPhone);
      logEvent('warn', 'Max attempts exceeded', {
        phone: normalizedPhone
      });
      return res.status(400).json({ 
        success: false,
        error: 'Too many failed attempts. Please request a new OTP.' 
      });
    }
    
    // Check expiry
    if (Date.now() > stored.expiresAt) {
      sessionStore.delete(normalizedPhone);
      logEvent('warn', 'Session expired', {
        phone: normalizedPhone
      });
      return res.status(400).json({ 
        success: false,
        error: 'OTP has expired. Please request a new OTP.' 
      });
    }
    
    // Verify with 2Factor
    const result = await verifyOtpWith2Factor(stored.sessionId, otp);
    
    if (result.success) {
      // OTP verified successfully
      sessionStore.delete(normalizedPhone);
      logEvent('info', 'OTP verified successfully', {
        phone: normalizedPhone
      });
      
      // Get user
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
      
      // Update last login
      await pool.query(
        'UPDATE users SET last_login = NOW() WHERE phone = $1',
        [normalizedPhone]
      );
      
      return res.json({ 
        success: true,
        message: 'Login successful', 
        user: userResult.rows[0] 
      });
    } else {
      // Verification failed
      stored.attempts += 1;
      const remainingAttempts = MAX_ATTEMPTS - stored.attempts;
      
      logEvent('warn', 'OTP verification failed', {
        phone: normalizedPhone,
        attemptsUsed: stored.attempts,
        attemptsRemaining: remainingAttempts,
        error: result.error
      });
      
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        error: result.error,
        attemptsRemaining: remainingAttempts
      });
    }
  } catch (err) {
    logEvent('error', 'Unhandled error in verify-otp', {
      error: err.message,
      stack: err.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Server error. Please try again.'
    });
  }
});

/**
 * POST /register
 * Request: { firstName, lastName, address, pincode, phone, otp }
 * Response: { success: boolean, message: string, user?: object }
 */
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, address, pincode, phone, otp } = req.body;
    
    logEvent('info', 'Registration request received', {
      firstNameProvided: !!firstName,
      lastNameProvided: !!lastName,
      phoneProvided: !!phone,
      otpProvided: !!otp
    });
    
    // Validate all fields
    if (!firstName || !lastName || !address || !pincode || !phone || !otp) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required' 
      });
    }
    
    if (!isValidPhone(phone)) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid phone number required' 
      });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const stored = sessionStore.get(normalizedPhone);
    
    if (!stored) {
      logEvent('warn', 'No session found for registration', {
        phone: normalizedPhone
      });
      return res.status(400).json({ 
        success: false,
        error: 'No OTP requested. Please request a new OTP.' 
      });
    }
    
    if (stored.attempts >= MAX_ATTEMPTS) {
      sessionStore.delete(normalizedPhone);
      return res.status(400).json({ 
        success: false,
        error: 'Too many failed attempts. Please request a new OTP.' 
      });
    }
    
    if (Date.now() > stored.expiresAt) {
      sessionStore.delete(normalizedPhone);
      return res.status(400).json({ 
        success: false,
        error: 'OTP has expired. Please request a new OTP.' 
      });
    }
    
    // Verify OTP
    const result = await verifyOtpWith2Factor(stored.sessionId, otp);
    
    if (!result.success) {
      stored.attempts += 1;
      logEvent('warn', 'Registration OTP verification failed', {
        phone: normalizedPhone,
        attempts: stored.attempts
      });
      return res.status(400).json({
        success: false,
        error: result.error,
        attemptsRemaining: MAX_ATTEMPTS - stored.attempts
      });
    }
    
    // OTP verified successfully
    sessionStore.delete(normalizedPhone);
    logEvent('info', 'Registration OTP verified', {
      phone: normalizedPhone
    });
    
    // Check if user exists
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
    
    // Create user
    const result2 = await pool.query(
      `INSERT INTO users (first_name, last_name, address, pincode, phone, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [firstName, lastName, address, pincode, normalizedPhone]
    );
    
    logEvent('info', 'User registered successfully', {
      phone: normalizedPhone,
      userId: result2.rows[0].id
    });
    
    return res.status(201).json({ 
      success: true,
      message: 'Registration successful', 
      user: result2.rows[0] 
    });
  } catch (err) {
    logEvent('error', 'Unhandled error in register', {
      error: err.message,
      stack: err.stack
    });
    
    return res.status(500).json({ 
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
    const result = await pool.query(
      "SELECT value FROM settings WHERE key = 'admin_phones'"
    );
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
    logEvent('error', 'Error fetching admin phones', {
      error: err.message
    });
    return ['+919019825189', '+91827079552', '+919483685462'];
  }
}

router.post('/admin/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid phone number required' 
      });
    }
    
    const normalizedPhone = normalizePhone(phone);
    const adminPhones = await getAdminPhones();
    const isAdmin = adminPhones.some(p => p === normalizedPhone);
    
    if (!isAdmin) {
      logEvent('warn', 'Non-admin attempted admin OTP', {
        phone: normalizedPhone
      });
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized as admin' 
      });
    }
    
    logEvent('info', 'Admin OTP request', {
      phone: normalizedPhone
    });
    
    const result = await sendOtpViaAutogen(normalizedPhone, 'OTP1');
    
    if (!result.success) {
      return res.status(result.statusCode || 500).json({
        success: false,
        error: result.error
      });
    }
    
    sessionStore.set(normalizedPhone, {
      sessionId: result.sessionId,
      expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
      attempts: 0,
      createdAt: Date.now(),
      isAdmin: true
    });
    
    logEvent('info', 'Admin OTP sent successfully', {
      phone: normalizedPhone
    });
    
    return res.json({ 
      success: true,
      message: 'Admin OTP sent successfully' 
    });
  } catch (err) {
    logEvent('error', 'Unhandled error in admin send-otp', {
      error: err.message
    });
    return res.status(500).json({ 
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
    
    const stored = sessionStore.get(normalizedPhone);
    
    if (!stored) {
      return res.status(400).json({ 
        success: false,
        error: 'No OTP requested. Please request a new OTP.' 
      });
    }
    
    if (stored.attempts >= MAX_ATTEMPTS) {
      sessionStore.delete(normalizedPhone);
      return res.status(400).json({ 
        success: false,
        error: 'Too many failed attempts. Please request a new OTP.' 
      });
    }
    
    if (Date.now() > stored.expiresAt) {
      sessionStore.delete(normalizedPhone);
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
    
    sessionStore.delete(normalizedPhone);
    logEvent('info', 'Admin login successful', {
      phone: normalizedPhone
    });
    
    return res.json({ 
      success: true,
      message: 'Admin login successful', 
      admin: true 
    });
  } catch (err) {
    logEvent('error', 'Unhandled error in admin verify-otp', {
      error: err.message
    });
    return res.status(500).json({ 
      success: false,
      error: 'Server error. Please try again.' 
    });
  }
});

// ============================================================
// SESSION STATUS (Debug only - remove in production)
// ============================================================
if (process.env.NODE_ENV !== 'production') {
  router.get('/session-status/:phone', (req, res) => {
    const phone = req.params.phone;
    const normalized = normalizePhone(phone);
    const stored = sessionStore.get(normalized);
    
    if (!stored) {
      return res.json({ 
        exists: false, 
        message: 'No session found' 
      });
    }
    
    return res.json({
      exists: true,
      phone: normalized,
      sessionId: stored.sessionId ? stored.sessionId.substring(0, 8) + '...' : null,
      attempts: stored.attempts,
      expiresAt: new Date(stored.expiresAt).toISOString(),
      timeRemaining: Math.max(0, Math.floor((stored.expiresAt - Date.now()) / 1000)),
      isExpired: Date.now() > stored.expiresAt
    });
  });
}

module.exports = router;