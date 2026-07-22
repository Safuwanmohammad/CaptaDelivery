const pool = require('../db');

exports.getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    console.error('Error in getAllProducts:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE category = $1', [req.params.category]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error in getProductsByCategory:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in getProductById:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createProduct = async (req, res) => {
  const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
  try {
    // Ensure images and variants are arrays
    const imagesArray = Array.isArray(images) ? images : [];
    const variantsArray = Array.isArray(variants) ? variants : [];
    
    const result = await pool.query(
      `INSERT INTO products (name, category, restaurant_id, price, commission, status, images, variants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        name, 
        category, 
        restaurantId, 
        price, 
        commission, 
        status, 
        JSON.stringify(imagesArray), 
        JSON.stringify(variantsArray)
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
  try {
    // Ensure images and variants are arrays
    const imagesArray = Array.isArray(images) ? images : [];
    const variantsArray = Array.isArray(variants) ? variants : [];
    
    const result = await pool.query(
      `UPDATE products SET 
        name = $1, 
        category = $2, 
        restaurant_id = $3, 
        price = $4, 
        commission = $5, 
        status = $6, 
        images = $7, 
        variants = $8
       WHERE id = $9 
       RETURNING *`,
      [
        name, 
        category, 
        restaurantId, 
        price, 
        commission, 
        status, 
        JSON.stringify(imagesArray), 
        JSON.stringify(variantsArray), 
        id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: err.message });
  }
};