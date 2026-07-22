require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');
const app = express();
const PORT = process.env.PORT || 5000;

// ===== RUN MIGRATIONS ON STARTUP =====
// Set RUN_MIGRATION=true in environment variables to enable
if (process.env.RUN_MIGRATION === 'true') {
  console.log('🔄 Running database migrations...');
  const { exec } = require('child_process');
  
  // Run migrations in sequence
  const runMigrations = async () => {
    try {
      // First, add variants column if missing
      await new Promise((resolve, reject) => {
        exec('node add-variants-column.js', (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Add variants error: ${error}`);
            console.error(`stderr: ${stderr}`);
            reject(error);
            return;
          }
          console.log(`✅ Add variants output: ${stdout}`);
          resolve();
        });
      });
      
      // Then run the main migration
      await new Promise((resolve, reject) => {
        exec('node migrate-db.js', (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Migration error: ${error}`);
            console.error(`stderr: ${stderr}`);
            reject(error);
            return;
          }
          console.log(`✅ Migration output: ${stdout}`);
          resolve();
        });
      });
      
      console.log('✅ All migrations completed successfully!');
    } catch (err) {
      console.error('❌ Migration failed:', err);
    }
  };
  
  runMigrations();
}

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== DEBUG: Log all requests =====
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  if (req.method === 'PUT' || req.method === 'POST') {
    console.log('  Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

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
const frontendPath = path.join(__dirname, '../frontend');
console.log(`📁 Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// ===== FALLBACK =====
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  console.error('Stack:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📁 Serving frontend from: ${frontendPath}`);
  console.log(`🔗 Visit: http://localhost:${PORT}`);
  console.log(`📊 Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`🔧 Migration status: ${process.env.RUN_MIGRATION === 'true' ? 'Enabled' : 'Disabled'}`);
});

module.exports = app;