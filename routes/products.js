const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all products
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get products by category - MUST come before /:id
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE category = $1', [category]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products by category:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single product - MUST come AFTER /category/:category
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create product
router.post('/', async (req, res) => {
  const { name, category, restaurant_id, price, commission, status, images, variants } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO products (name, category, restaurant_id, price, commission, status, images, variants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, category, restaurant_id || null, price || 0, commission || 0, status || 'Active', images || [], variants || []]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, restaurant_id, price, commission, status, images, variants } = req.body;
  try {
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query(
      `UPDATE products SET 
        name = $1, category = $2, restaurant_id = $3, price = $4, 
        commission = $5, status = $6, images = $7, variants = $8
       WHERE id = $9 RETURNING *`,
      [name, category, restaurant_id || null, price || 0, commission || 0, status || 'Active', images || [], variants || [], productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;