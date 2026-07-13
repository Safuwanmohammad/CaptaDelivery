const pool = require('../db');

exports.getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    // Provide defaults for missing keys
    const defaults = {
      active_admin_phone: '+919019825189',
      default_commission: '10',
      rain_fare: '20',
      delivery_hours: '9:00 AM - 10:00 PM',
      unavailable_days: '[]',
      service_unavailable: 'false'
    };
    Object.keys(defaults).forEach(key => {
      if (!settings[key]) settings[key] = defaults[key];
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSetting = async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
};