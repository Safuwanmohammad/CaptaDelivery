require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// ENVIRONMENT VALIDATION
// ============================================================
console.log('\n=================================================');
console.log('🚀 CaptaDelivery Server Starting');
console.log('=================================================');
console.log(`  Environment:  ${process.env.NODE_ENV || 'development'}`);
console.log(`  Port:         ${PORT}`);

// Validate critical environment variables
const requiredEnv = ['DATABASE_URL'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Check 2Factor API Key (warn but don't fail)
if (!process.env.TWO_FACTOR_API_KEY) {
  console.warn('⚠️  TWO_FACTOR_API_KEY is not set. OTP functionality will not work.');
} else {
  console.log(`✅ TWO_FACTOR_API_KEY: ${process.env.TWO_FACTOR_API_KEY ? 'Configured' : 'Missing'}`);
}

console.log('=================================================\n');

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== DEBUG: Log all requests (development only) =====
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.url}`);
    if (req.method === 'PUT' || req.method === 'POST') {
      // Don't log sensitive data like OTP requests
      if (req.url.includes('/auth')) {
        console.log('  Body: [SENSITIVE DATA HIDDEN]');
      } else {
        console.log('  Body:', JSON.stringify(req.body, null, 2));
      }
    }
    next();
  });
}

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      database: 'connected',
      time: result.rows[0].now,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message
    });
  }
});

// ============================================================
// API ROUTES
// ============================================================
app.use('/api/categories', require('./routes/categories'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/places', require('./routes/places'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/reports', require('./routes/reports'));

// ============================================================
// SERVE STATIC FRONTEND
// ============================================================
const frontendPath = path.join(__dirname, '../frontend');
console.log(`📁 Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// ============================================================
// FALLBACK
// ============================================================
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  console.error('Stack:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📁 Serving frontend from: ${frontendPath}`);
  console.log(`🔗 Visit: http://localhost:${PORT}`);
  console.log(`📊 Admin panel: http://localhost:${PORT}/admin.html`);
});

module.exports = app;