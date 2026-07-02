const pool = require('../db');

exports.getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE category = $1', [req.params.category]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createProduct = async (req, res) => {
  const { name, category, restaurantId, price, commission, status, images } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO products (name, category, restaurant_id, price, commission, status, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, category, restaurantId, price, commission, status, images || []]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, category, restaurantId, price, commission, status, images } = req.body;
  try {
    const result = await pool.query(
      `UPDATE products SET name=$1, category=$2, restaurant_id=$3, price=$4, commission=$5, status=$6, images=$7
       WHERE id=$8 RETURNING *`,
      [name, category, restaurantId, price, commission, status, images, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};