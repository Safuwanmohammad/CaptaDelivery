const pool = require('../db');

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    console.error('Error in getAllProducts:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE category = $1', [category]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error in getProductsByCategory:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get product by ID - with validation
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // ⭐ Validate that ID is a number
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({ 
        error: 'Invalid product ID format. ID must be a number.' 
      });
    }
    
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in getProductById:', err);
    res.status(500).json({ error: err.message });
  }
};

// Create product
exports.createProduct = async (req, res) => {
  try {
    const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
    
    let imagesArray = images || [];
    if (typeof imagesArray === 'string') {
      try {
        imagesArray = JSON.parse(imagesArray);
      } catch (e) {
        imagesArray = [imagesArray];
      }
    }
    if (!Array.isArray(imagesArray)) {
      imagesArray = [imagesArray];
    }
    
    const imagesText = imagesArray.length > 0 
      ? `{${imagesArray.map(img => `"${img.replace(/"/g, '\\"')}"`).join(',')}}`
      : '{}';
    
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
        imagesText, 
        JSON.stringify(variantsArray)
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }
    
    const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
    
    let imagesArray = images || [];
    if (typeof imagesArray === 'string') {
      try {
        imagesArray = JSON.parse(imagesArray);
      } catch (e) {
        imagesArray = [imagesArray];
      }
    }
    if (!Array.isArray(imagesArray)) {
      imagesArray = [imagesArray];
    }
    
    const imagesText = imagesArray.length > 0 
      ? `{${imagesArray.map(img => `"${img.replace(/"/g, '\\"')}"`).join(',')}}`
      : '{}';
    
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
        imagesText, 
        JSON.stringify(variantsArray), 
        productId
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

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }
    
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [productId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: err.message });
  }
};