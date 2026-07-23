const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Add type parsing for JSONB
const { types } = require('pg');

// Parse JSONB to JavaScript objects
types.setTypeParser(types.builtins.JSONB, (val) => {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch (e) {
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