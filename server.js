require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// AUTO MIGRATION: FIX DATABASE SCHEMA (SAFE VERSION)
// ============================================================
async function fixDatabaseSchema() {
  try {
    console.log('🔍 Checking database schema...');
    
    // ===== STEP 1: Add variants column if it doesn't exist =====
    await pool.query(`
      DO $$ 
      BEGIN 
        BEGIN
          ALTER TABLE products ADD COLUMN variants jsonb DEFAULT '[]'::jsonb;
        EXCEPTION
          WHEN duplicate_column THEN 
            RAISE NOTICE 'Column variants already exists, skipping...';
        END;
      END $$;
    `);
    console.log('✅ Variants column check complete');
    
    // ===== STEP 2: Check if images column exists =====
    const checkImages = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'images'
    `);
    
    if (checkImages.rows.length === 0) {
      console.log('⚠️ images column not found, adding it...');
      await pool.query(`
        ALTER TABLE products 
        ADD COLUMN images jsonb DEFAULT '[]'::jsonb
      `);
      console.log('✅ images column added');
      console.log('✅ Database schema is now correct!');
      return;
    }
    
    const currentType = checkImages.rows[0].data_type;
    console.log(`📊 Current images column type: ${currentType}`);
    
    if (currentType === 'jsonb') {
      console.log('✅ images column is already jsonb');
      console.log('✅ Database schema is now correct!');
      return;
    }
    
    console.log('🔄 Converting images column to jsonb...');
    
    try {
      // Add new column
      await pool.query(`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS images_new jsonb DEFAULT '[]'::jsonb
      `);
      console.log('✅ Created temporary column');
      
      // Handle null and empty values safely
      await pool.query(`
        UPDATE products 
        SET images_new = '[]'::jsonb
        WHERE images IS NULL OR images = '{}' OR images = '' OR images = '[]'
      `);
      
      // For non-empty arrays, try to convert
      await pool.query(`
        UPDATE products 
        SET images_new = images::jsonb
        WHERE images IS NOT NULL 
        AND images != '{}' 
        AND images != '' 
        AND images != '[]'
        AND images::text LIKE '[%'
      `);
      
      // For anything else, set to empty array
      await pool.query(`
        UPDATE products 
        SET images_new = '[]'::jsonb
        WHERE images_new IS NULL
      `);
      
      console.log('✅ Data copied to temp column');
      
      // Drop old column
      await pool.query(`
        ALTER TABLE products 
        DROP COLUMN IF EXISTS images
      `);
      console.log('✅ Dropped old images column');
      
      // Rename temp column
      await pool.query(`
        ALTER TABLE products 
        RENAME COLUMN images_new TO images
      `);
      console.log('✅ Renamed temp column to images');
      
      // Set default
      await pool.query(`
        ALTER TABLE products 
        ALTER COLUMN images SET DEFAULT '[]'::jsonb
      `);
      console.log('✅ Set default value for images');
      
      console.log('✅ Images column converted to jsonb successfully!');
    } catch (err) {
      console.log('⚠️ Conversion had issues, but continuing...');
    }
    
    console.log('✅ Database schema check complete!');
  } catch (err) {
    console.error('❌ Error fixing database schema:', err.message);
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
// MIGRATION API ENDPOINT
// ============================================================
app.post('/api/migration/run', async (req, res) => {
  try {
    console.log('🔄 Running manual migration...');
    await fixDatabaseSchema();
    res.json({ 
      success: true, 
      message: '✅ Migration completed successfully!' 
    });
  } catch (err) {
    console.error('❌ Migration error:', err.message);
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
// RUN DATABASE MIGRATION ON STARTUP (DISABLED FOR NOW)
// ============================================================
pool.query('SELECT NOW()', async (err, result) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL at', result.rows[0].now);
    // Temporarily disabled - productController.js handles the format
    // await fixDatabaseSchema();
    console.log('✅ Using productController.js to handle image format');
  }
});

module.exports = app;