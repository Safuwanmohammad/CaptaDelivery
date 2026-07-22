const pool = require('./db');

async function migrateOnStartup() {
  try {
    console.log('🔄 Running startup migration...');
    
    // Check if variants column exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'variants'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ variants column already exists');
      process.exit(0);
    }
    
    // Add variants column as jsonb
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN variants jsonb DEFAULT '[]'::jsonb
    `);
    
    console.log('✅ variants column added successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error adding column:', err.message);
    process.exit(1);
  }
}

migrateOnStartup();