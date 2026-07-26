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
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return parsed;
  } catch (e) {
    console.warn('⚠️ Failed to parse JSONB:', val);
    return [];
  }
});

// Parse JSON (if any)
types.setTypeParser(types.builtins.JSON, (val) => {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch (e) {
    return [];
  }
});

// Set timezone for the session
pool.query("SET TIME ZONE 'Asia/Kolkata'", (err) => {
  if (err) {
    console.warn('⚠️ Could not set timezone:', err.message);
  } else {
    console.log('✅ Timezone set to Asia/Kolkata');
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