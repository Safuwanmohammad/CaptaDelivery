const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all places
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM places ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching places:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single place
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query('SELECT * FROM places WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Place not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching place:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create place
router.post('/', async (req, res) => {
  const { area, sub_area, charge, min_order, time, status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO places (area, sub_area, charge, min_order, time, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [area, sub_area, charge, min_order || 0, time || '20-30 min', status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating place:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update place
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { area, sub_area, charge, min_order, time, status } = req.body;
  try {
    const placeId = parseInt(id);
    if (isNaN(placeId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query(
      'UPDATE places SET area=$1, sub_area=$2, charge=$3, min_order=$4, time=$5, status=$6 WHERE id=$7 RETURNING *',
      [area, sub_area, charge, min_order, time, status, placeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Place not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating place:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete place
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const placeId = parseInt(id);
    if (isNaN(placeId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    await pool.query('DELETE FROM places WHERE id = $1', [placeId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting place:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;