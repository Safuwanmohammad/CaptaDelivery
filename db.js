const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// IMPORTANT: Add type parsing for JSONB
const { types } = require('pg');

// Parse JSONB to JavaScript object/array
types.setTypeParser(types.builtins.JSONB, (val) => {
  try {
    return JSON.parse(val);
  } catch (e) {
    return val;
  }
});

// Parse JSON (if any)
types.setTypeParser(types.builtins.JSON, (val) => {
  try {
    return JSON.parse(val);
  } catch (e) {
    return val;
  }
});

// Test connection
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL at', result.rows[0].now);
  }
});

module.exports = pool;