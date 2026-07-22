const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM places');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { area, sub_area, charge, min_order, time, status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO places (area, sub_area, charge, min_order, time, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [area, sub_area, charge, min_order || 0, time || '20-30 min', status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { area, sub_area, charge, min_order, time, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE places SET area=$1, sub_area=$2, charge=$3, min_order=$4, time=$5, status=$6 WHERE id=$7 RETURNING *',
      [area, sub_area, charge, min_order, time, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Place not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM places WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;