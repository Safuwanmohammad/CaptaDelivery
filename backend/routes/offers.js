const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all offers
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM offers ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error in GET offers:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET single offer by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM offers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in GET offer by id:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create new offer
router.post('/', async (req, res) => {
  const { title, discount, code, bg, icon, restaurant_id, category, description } = req.body;
  try {
    if (!title || !discount) {
      return res.status(400).json({ error: 'Title and discount are required' });
    }
    const result = await pool.query(
      `INSERT INTO offers (title, discount, code, bg, icon, restaurant_id, category, description) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, discount, code || null, bg || null, icon || null, restaurant_id || null, category || null, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Offer code already exists' });
    }
    console.error('Error in POST offer:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update offer
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, discount, code, bg, icon, restaurant_id, category, description } = req.body;
  try {
    if (!title || !discount) {
      return res.status(400).json({ error: 'Title and discount are required' });
    }
    const result = await pool.query(
      `UPDATE offers SET 
        title = $1, 
        discount = $2, 
        code = $3, 
        bg = $4, 
        icon = $5, 
        restaurant_id = $6, 
        category = $7, 
        description = $8 
       WHERE id = $9 RETURNING *`,
      [title, discount, code, bg, icon, restaurant_id || null, category || null, description || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in PUT offer:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE offer
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM offers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    res.json({ success: true, message: 'Offer deleted successfully' });
  } catch (err) {
    console.error('Error in DELETE offer:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;