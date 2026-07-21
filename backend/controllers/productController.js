const pool = require('../db');

// Get all products with restaurant details
exports.getAllProducts = async (req, res) => {
  try {
    console.log('[Products] Fetching all products...');
    
    const result = await pool.query(`
      SELECT p.*, r.name as restaurant_name
      FROM products p
      LEFT JOIN restaurants r ON p.restaurant_id = r.id
      ORDER BY p.id
    `);
    
    const products = result.rows.map(row => {
      let variants = [];
      if (row.variants) {
        try {
          variants = typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants;
        } catch (e) {
          variants = [];
        }
      }
      return {
        id: row.id,
        name: row.name || '',
        price: parseFloat(row.price) || 0,
        category: row.category || null,
        restaurant_id: row.restaurant_id || null,
        restaurant_name: row.restaurant_name || null,
        commission: parseFloat(row.commission) || 0,
        status: row.status || 'Active',
        images: row.images || [],
        variants: variants,
        created_at: row.created_at || null
      };
    });
    
    console.log(`[Products] Found ${products.length} products`);
    res.json(products);
  } catch (err) {
    console.error('[Products] Error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch products', 
      details: err.message
    });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    console.log(`[Products] Fetching for category: ${category}`);
    
    const result = await pool.query(
      `SELECT p.*, r.name as restaurant_name
       FROM products p
       LEFT JOIN restaurants r ON p.restaurant_id = r.id
       WHERE p.category = $1
       ORDER BY p.id`,
      [category]
    );
    
    const products = result.rows.map(row => {
      let variants = [];
      if (row.variants) {
        try {
          variants = typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants;
        } catch (e) {
          variants = [];
        }
      }
      return { ...row, variants };
    });
    
    res.json(products);
  } catch (err) {
    console.error('[Products] Category error:', err);
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
    console.log('[Products] Creating:', { name, category, restaurantId, price, variants });
    
    // Validate
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (!category || category.trim() === '') {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!price || isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }
    
    // Ensure variants is an array
    const variantsArray = Array.isArray(variants) ? variants : [];
    const variantsJson = JSON.stringify(variantsArray);
    
    const result = await pool.query(
      `INSERT INTO products (name, category, restaurant_id, price, commission, status, images, variants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name.trim(), category.trim(), restaurantId || null, price, 
       commission || 0, status || 'Active', images || [], variantsJson]
    );
    
    console.log('[Products] Created:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Products] Create error:', err);
    res.status(500).json({ error: 'Failed to create product', details: err.message });
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
    console.log('[Products] Updating:', { id, name, variants });
    
    // Validate
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (!category || category.trim() === '') {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!price || isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }
    
    // Check if product exists
    const exists = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Ensure variants is an array
    const variantsArray = Array.isArray(variants) ? variants : [];
    const variantsJson = JSON.stringify(variantsArray);
    
    const result = await pool.query(
      `UPDATE products 
       SET name = $1, category = $2, restaurant_id = $3, price = $4, 
           commission = $5, status = $6, images = $7, variants = $8
       WHERE id = $9 RETURNING *`,
      [name.trim(), category.trim(), restaurantId || null, price, 
       commission || 0, status || 'Active', images || [], variantsJson, id]
    );
    
    console.log('[Products] Updated:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Products] Update error:', err);
    res.status(500).json({ error: 'Failed to update product', details: err.message });
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Products] Deleting:', id);
    
    const exists = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    console.log('[Products] Deleted:', id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    console.error('[Products] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete product', details: err.message });
  }
};