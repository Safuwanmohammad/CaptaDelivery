const pool = require('../db');

exports.getWhatsAppLogs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM whatsapp_logs ORDER BY sent_at DESC LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};