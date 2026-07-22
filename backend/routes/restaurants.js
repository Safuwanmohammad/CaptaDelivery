const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurants');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, category, logo, status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO restaurants (name, category, logo, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, category, logo, status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, logo, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE restaurants SET name=$1, category=$2, logo=$3, status=$4 WHERE id=$5 RETURNING *',
      [name, category, logo, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM restaurants WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;