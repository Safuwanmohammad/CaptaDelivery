const pool = require('../db');

// ===== GET ALL PRODUCTS =====
exports.getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ getAllProducts error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ===== GET PRODUCTS BY CATEGORY =====
exports.getProductsByCategory = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE category = $1', [req.params.category]);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ getProductsByCategory error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ===== CREATE PRODUCT =====
exports.createProduct = async (req, res) => {
  const { name, category, restaurantId, price, commission, status, images } = req.body;

  // Validate required fields
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  try {
    // Map restaurantId to restaurant_id (database column name)
    const restaurant_id = restaurantId || null;
    // Ensure images is an array, default to empty array if not provided
    const imagesArray = Array.isArray(images) ? images : [];

    const result = await pool.query(
      `INSERT INTO products (name, category, restaurant_id, price, commission, status, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, category, restaurant_id, price, commission, status, imagesArray]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ createProduct error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ===== UPDATE PRODUCT =====
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, category, restaurantId, price, commission, status, images } = req.body;

  try {
    const restaurant_id = restaurantId || null;
    const imagesArray = Array.isArray(images) ? images : [];

    const result = await pool.query(
      `UPDATE products SET 
        name = $1, 
        category = $2, 
        restaurant_id = $3, 
        price = $4, 
        commission = $5, 
        status = $6, 
        images = $7
       WHERE id = $8 RETURNING *`,
      [name, category, restaurant_id, price, commission, status, imagesArray, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ updateProduct error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ===== DELETE PRODUCT =====
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('❌ deleteProduct error:', err);
    res.status(500).json({ error: err.message });
  }
};