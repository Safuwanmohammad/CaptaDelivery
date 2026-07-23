const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all places
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM places ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error in GET places:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET single place by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM places WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Place not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in GET place by id:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create new place
router.post('/', async (req, res) => {
  const { area, sub_area, charge, min_order, time, status } = req.body;
  try {
    if (!area || !sub_area || charge === undefined) {
      return res.status(400).json({ error: 'Area, sub_area and charge are required' });
    }
    const result = await pool.query(
      `INSERT INTO places (area, sub_area, charge, min_order, time, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [area, sub_area, charge, min_order || 0, time || '20-30 min', status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error in POST place:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update place
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { area, sub_area, charge, min_order, time, status } = req.body;
  try {
    if (!area || !sub_area || charge === undefined) {
      return res.status(400).json({ error: 'Area, sub_area and charge are required' });
    }
    const result = await pool.query(
      `UPDATE places SET 
        area = $1, 
        sub_area = $2, 
        charge = $3, 
        min_order = $4, 
        time = $5, 
        status = $6 
       WHERE id = $7 RETURNING *`,
      [area, sub_area, charge, min_order, time, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Place not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in PUT place:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE place
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM places WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Place not found' });
    }
    res.json({ success: true, message: 'Place deleted successfully' });
  } catch (err) {
    console.error('Error in DELETE place:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;