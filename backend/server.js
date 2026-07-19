require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== HEALTH CHECK =====
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      database: 'connected',
      time: result.rows[0].now,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message
    });
  }
});

// ===== API ROUTES =====
// Make sure all these route files exist
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

// ===== SERVE STATIC FRONTEND =====
const frontendPath = path.resolve(__dirname, '../frontend');
console.log(`📁 Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// ===== FALLBACK: serve index.html for unknown routes (SPA support) =====
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ===== ERROR HANDLING MIDDLEWARE =====
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  console.error('Stack:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📁 Serving frontend from: ${frontendPath}`);
  console.log(`🔗 Visit: http://localhost:${PORT}`);
  console.log(`📊 Admin panel: http://localhost:${PORT}/admin.html`);
});

module.exports = app;