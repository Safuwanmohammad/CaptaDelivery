require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');
const app = express();
const PORT = process.env.PORT || 5000;

// ===== AUTO MIGRATION: FIX DATABASE SCHEMA =====
async function fixDatabaseSchema() {
  try {
    console.log('🔍 Checking database schema...');
    
    // Step 1: Add variants column if it doesn't exist
    const checkVariants = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'variants'
    `);
    
    if (checkVariants.rows.length === 0) {
      console.log('🔄 Adding variants column...');
      await pool.query(`
        ALTER TABLE products 
        ADD COLUMN variants jsonb DEFAULT '[]'::jsonb
      `);
      console.log('✅ Variants column added!');
    } else {
      console.log('✅ Variants column already exists');
    }
    
    // Step 2: Check if images column is text[] and convert if needed
    const checkImages = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'images'
    `);
    
    if (checkImages.rows.length > 0 && checkImages.rows[0].data_type === 'text[]') {
      console.log('🔄 Converting images column from text[] to jsonb...');
      
      // Add a temporary jsonb column
      await pool.query(`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS images_new jsonb DEFAULT '[]'::jsonb
      `);
      
      // Copy data from old column to new column, handling the conversion
      await pool.query(`
        UPDATE products 
        SET images_new = COALESCE(
          CASE 
            WHEN images IS NULL OR images = '{}' THEN '[]'::jsonb
            ELSE images::jsonb
          END,
          '[]'::jsonb
        )
        WHERE images IS NOT NULL AND images != '{}'
      `);
      console.log('✅ Data copied to images_new');
      
      // Drop the old column
      await pool.query(`
        ALTER TABLE products 
        DROP COLUMN IF EXISTS images
      `);
      console.log('✅ Dropped old images column');
      
      // Rename the new column
      await pool.query(`
        ALTER TABLE products 
        RENAME COLUMN images_new TO images
      `);
      console.log('✅ Renamed images_new to images');
      
      // Set default value
      await pool.query(`
        ALTER TABLE products 
        ALTER COLUMN images SET DEFAULT '[]'::jsonb
      `);
      console.log('✅ Set default value for images');
    } else if (checkImages.rows.length > 0) {
      console.log(`✅ images column already is ${checkImages.rows[0].data_type}`);
    }
    
    console.log('✅ Database schema check complete!');
  } catch (err) {
    console.error('❌ Error fixing database schema:', err.message);
    // Don't exit, just log the error
  }
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
});

// Run database schema fix after connection is established
pool.query('SELECT NOW()', async (err, result) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL at', result.rows[0].now);
    // Run schema fix
    await fixDatabaseSchema();
  }
});

module.exports = app;