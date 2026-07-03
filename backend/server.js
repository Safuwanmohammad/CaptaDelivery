require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Routes
app.use('/api/categories', require('./routes/categories'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/places', require('./routes/places'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));

// Serve static frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// 404 handler
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Database test
pool.query('SELECT NOW()', (err, result) => {
  if (err) console.error('❌ Database connection error:', err.message);
  else console.log('✅ Connected to PostgreSQL at', result.rows[0].now);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));