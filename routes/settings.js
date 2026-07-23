const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all settings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    // Provide defaults for missing keys
    const defaults = {
      active_admin_phone: '+919019825189',
      admin_phones: '["+919019825189","+91827079552","+919999999999"]',
      default_commission: '10',
      rain_fare: '20',
      rain_fare_enabled: 'true',
      delivery_hours: '9:00 AM - 10:00 PM',
      unavailable_days: '[]',
      service_unavailable: 'false'
    };
    Object.keys(defaults).forEach(key => {
      if (!settings[key]) settings[key] = defaults[key];
    });
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update setting
router.put('/', async (req, res) => {
  const { key, value } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'Key is required' });
  }
  try {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;