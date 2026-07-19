const { Pool } = require('pg');
require('dotenv').config();

// Neon PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection on startup
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL at', result.rows[0].now);
  }
});

module.exports = pool;