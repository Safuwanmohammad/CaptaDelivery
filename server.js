require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// WHATSAPP WEBHOOK - VERIFICATION (GET)
// ============================================================
app.get('/webhook', (req, res) => {
  console.log('🔍 Webhook verification request received');
  console.log('Query params:', req.query);
  
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'CaptaDeliveryVerify2026';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log(`  Mode: ${mode}`);
  console.log(`  Token: ${token}`);
  console.log(`  Expected Token: ${VERIFY_TOKEN}`);
  console.log(`  Challenge: ${challenge}`);
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    console.log(`  Mode match: ${mode === 'subscribe'}`);
    console.log(`  Token match: ${token === VERIFY_TOKEN}`);
    res.sendStatus(403);
  }
});

// ============================================================
// WHATSAPP WEBHOOK - INCOMING MESSAGES (POST)
// ============================================================
app.post('/webhook', express.json({ type: 'application/json' }), (req, res) => {
  try {
    const body = req.body;
    console.log('📩 WhatsApp webhook POST received');
    
    if (body.object === 'whatsapp_business_account') {
      body.entry.forEach(entry => {
        entry.changes.forEach(change => {
          if (change.field === 'messages') {
            const message = change.value.messages[0];
            if (message) {
              console.log(`  From: ${message.from}`);
              console.log(`  Text: ${message.text?.body || 'No text'}`);
              // Process incoming message here
            }
          }
          if (change.field === 'message_status') {
            const status = change.value.statuses[0];
            console.log(`  Status: ${status.status} for message ${status.id}`);
          }
        });
      });
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

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
  if (!req.path.startsWith('/api') && !req.path.startsWith('/webhook')) {
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
  console.log(`📱 Webhook endpoint: http://localhost:${PORT}/webhook`);
});

module.exports = app;