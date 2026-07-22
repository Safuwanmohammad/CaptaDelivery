require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// AUTO MIGRATION: FIX DATABASE SCHEMA
// This runs automatically when the server starts
// ============================================================
async function fixDatabaseSchema() {
  try {
    console.log('🔍 Checking database schema...');
    
    // ===== STEP 1: Add variants column if it doesn't exist =====
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
      console.log('✅ Variants column added successfully!');
    } else {
      console.log('✅ Variants column already exists');
    }
    
    // ===== STEP 2: Convert images column from text[] to jsonb =====
    const checkImages = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'images'
    `);
    
    if (checkImages.rows.length > 0) {
      const currentType = checkImages.rows[0].data_type;
      console.log(`📊 Current images column type: ${currentType}`);
      
      // If it's text[] or text, convert it
      if (currentType === 'text[]' || currentType === 'text' || currentType === 'ARRAY') {
        console.log('🔄 Converting images column from text[] to jsonb...');
        
        try {
          // Method 1: Try direct conversion
          await pool.query(`
            ALTER TABLE products 
            ALTER COLUMN images TYPE jsonb 
            USING COALESCE(
              CASE 
                WHEN images IS NULL OR images = '{}' THEN '[]'::jsonb
                ELSE images::jsonb
              END,
              '[]'::jsonb
            )
          `);
          console.log('✅ Images column converted to jsonb successfully!');
        } catch (err) {
          console.log('⚠️ Direct conversion failed, trying alternative method...');
          
          // Method 2: Add temporary column, copy data, drop old, rename
          await pool.query(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS images_new jsonb DEFAULT '[]'::jsonb
          `);
          console.log('✅ Created temporary images_new column');
          
          await pool.query(`
            UPDATE products 
            SET images_new = COALESCE(
              CASE 
                WHEN images IS NULL OR images = '{}' OR images = '[]' THEN '[]'::jsonb
                ELSE images::jsonb
              END,
              '[]'::jsonb
            )
            WHERE images IS NOT NULL
          `);
          console.log('✅ Data copied to images_new');
          
          await pool.query(`
            ALTER TABLE products 
            DROP COLUMN IF EXISTS images
          `);
          console.log('✅ Dropped old images column');
          
          await pool.query(`
            ALTER TABLE products 
            RENAME COLUMN images_new TO images
          `);
          console.log('✅ Renamed images_new to images');
          
          await pool.query(`
            ALTER TABLE products 
            ALTER COLUMN images SET DEFAULT '[]'::jsonb
          `);
          console.log('✅ Set default value for images');
          
          console.log('✅ Images column converted to jsonb successfully!');
        }
        
        // Verify the conversion
        const verify = await pool.query(`
          SELECT data_type 
          FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'images'
        `);
        console.log(`✅ Verification: images column is now ${verify.rows[0].data_type}`);
        
      } else {
        console.log(`✅ images column already has correct type: ${currentType}`);
      }
    } else {
      console.log('⚠️ images column not found, adding it...');
      await pool.query(`
        ALTER TABLE products 
        ADD COLUMN images jsonb DEFAULT '[]'::jsonb
      `);
      console.log('✅ images column added');
    }
    
    console.log('✅ Database schema is now correct!');
  } catch (err) {
    console.error('❌ Error fixing database schema:', err.message);
    console.error('Stack:', err.stack);
  }
}

// ============================================================
// MIDDLEWARE
// ============================================================
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
// MIGRATION API ENDPOINT (for manual trigger if needed)
// ============================================================
app.post('/api/migration/run', async (req, res) => {
  try {
    console.log('🔄 Running manual migration via API...');
    await fixDatabaseSchema();
    res.json({ 
      success: true, 
      message: '✅ Database migration completed successfully!' 
    });
  } catch (err) {
    console.error('❌ Migration API error:', err.message);
    res.status(500).json({ 
      success: false, 
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
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
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

// ============================================================
// RUN DATABASE MIGRATION ON STARTUP
// ============================================================
// Wait for database connection, then run migration
pool.query('SELECT NOW()', async (err, result) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL at', result.rows[0].now);
    // Run the migration
    await fixDatabaseSchema();
  }
});

module.exports = app;