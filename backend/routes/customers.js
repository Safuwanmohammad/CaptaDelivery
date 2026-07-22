const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/block', async (req, res) => {
  const { id } = req.params;
  const { blocked } = req.body;
  try {
    const result = await pool.query('UPDATE users SET blocked=$1 WHERE id=$2 RETURNING *', [blocked, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { total_orders, total_spent, last_order } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET total_orders=$1, total_spent=$2, last_order=$3 WHERE id=$4 RETURNING *',
      [total_orders, total_spent, last_order, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;