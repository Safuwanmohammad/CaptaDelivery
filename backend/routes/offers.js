const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM offers');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { title, discount, code, bg, icon, restaurant_id, category, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO offers (title, discount, code, bg, icon, restaurant_id, category, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [title, discount, code, bg, icon, restaurant_id || null, category || null, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, discount, code, bg, icon, restaurant_id, category, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE offers SET title=$1, discount=$2, code=$3, bg=$4, icon=$5, restaurant_id=$6, category=$7, description=$8 WHERE id=$9 RETURNING *',
      [title, discount, code, bg, icon, restaurant_id || null, category || null, description || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Offer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM offers WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;