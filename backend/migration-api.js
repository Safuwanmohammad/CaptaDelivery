const express = require('express');
const router = express.Router();
const pool = require('./db');

// Manual migration endpoint - Add variants column
router.post('/run', async (req, res) => {
  try {
    console.log('🔄 Running manual migration...');
    
    // Check if variants column exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'variants'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ variants column already exists');
      return res.json({ 
        success: true, 
        message: '✅ variants column already exists',
        alreadyExists: true
      });
    }
    
    // Add variants column as jsonb
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN variants jsonb DEFAULT '[]'::jsonb
    `);
    
    console.log('✅ variants column added successfully!');
    
    res.json({ 
      success: true, 
      message: '✅ variants column added successfully!' 
    });
  } catch (err) {
    console.error('❌ Error adding column:', err.message);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  try {
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'variants'
    `);
    
    res.json({
      exists: checkColumn.rows.length > 0,
      columnExists: checkColumn.rows.length > 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;