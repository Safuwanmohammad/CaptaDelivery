const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all offers
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM offers');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single offer
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query('SELECT * FROM offers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create offer
router.post('/', async (req, res) => {
  const { title, discount, code, bg, icon, restaurant_id, category, description } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO offers (title, discount, code, bg, icon, restaurant_id, category, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, discount, code, bg, icon, restaurant_id || null, category || null, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update offer
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, discount, code, bg, icon, restaurant_id, category, description } = req.body;
  try {
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query(
      `UPDATE offers SET title=$1, discount=$2, code=$3, bg=$4, icon=$5, 
       restaurant_id=$6, category=$7, description=$8 WHERE id=$9 RETURNING *`,
      [title, discount, code, bg, icon, restaurant_id || null, category || null, description || null, offerId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete offer
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    await pool.query('DELETE FROM offers WHERE id = $1', [offerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;