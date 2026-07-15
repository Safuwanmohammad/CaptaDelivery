const { Pool } = require('pg');
require('dotenv').config();

// Neon PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
    sslmode: 'require' // Neon requires SSL
  },
  // Neon specific settings
  max: 10, // Max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to Neon PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Neon PostgreSQL error:', err.message);
});

module.exports = pool;