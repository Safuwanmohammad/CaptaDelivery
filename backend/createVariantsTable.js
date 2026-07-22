const pool = require('./db');

async function createVariantsTable() {
  try {
    const check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'product_variants'
      )
    `);
    
    if (check.rows[0].exists) {
      console.log('✅ product_variants table already exists');
      process.exit(0);
    }
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('✅ product_variants table created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating table:', err.message);
    process.exit(1);
  }
}

createVariantsTable();