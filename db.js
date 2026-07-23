const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Add type parsing for JSONB
const { types } = require('pg');

// Parse JSONB to JavaScript object/array
types.setTypeParser(types.builtins.JSONB, (val) => {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return parsed;
  } catch (e) {
    console.warn('⚠️ Failed to parse JSONB:', val);
    return [];
  }
});

// Parse JSON
types.setTypeParser(types.builtins.JSON, (val) => {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch (e) {
    return [];
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