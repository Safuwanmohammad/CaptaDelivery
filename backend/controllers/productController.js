const pool = require('../db');

// Get all products with restaurant details
exports.getAllProducts = async (req, res) => {
  try {
    // First, check what columns exist in the products table
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    console.log('Existing columns in products:', existingColumns);

    // Build query based on existing columns
    let selectFields = ['p.id', 'p.name', 'p.price'];
    
    // Add optional fields if they exist
    if (existingColumns.includes('category')) selectFields.push('p.category');
    if (existingColumns.includes('restaurant_id')) selectFields.push('p.restaurant_id');
    if (existingColumns.includes('commission')) selectFields.push('p.commission');
    if (existingColumns.includes('status')) selectFields.push('p.status');
    if (existingColumns.includes('images')) selectFields.push('p.images');
    if (existingColumns.includes('variants')) selectFields.push('p.variants');
    if (existingColumns.includes('created_at')) selectFields.push('p.created_at');
    
    // Always try to get restaurant name
    selectFields.push('r.name as restaurant_name');
    selectFields.push('r.category as restaurant_category');

    const query = `
      SELECT ${selectFields.join(', ')}
      FROM products p
      LEFT JOIN restaurants r ON p.restaurant_id = r.id
      ORDER BY p.id
    `;
    
    console.log('Products Query:', query);
    const result = await pool.query(query);
    
    // Transform results to ensure consistent structure
    const products = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      price: row.price,
      category: row.category || null,
      restaurant_id: row.restaurant_id || null,
      restaurant_name: row.restaurant_name || null,
      commission: row.commission || 0,
      status: row.status || 'Active',
      images: row.images || [],
      variants: row.variants || [],
      created_at: row.created_at || null
    }));
    
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ 
      error: 'Failed to fetch products', 
      details: err.message,
      code: err.code
    });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const query = `
      SELECT p.*, 
             r.name as restaurant_name,
             r.category as restaurant_category
      FROM products p
      LEFT JOIN restaurants r ON p.restaurant_id = r.id
      WHERE p.category = $1
      ORDER BY p.id
    `;
    const result = await pool.query(query, [category]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products by category:', err);
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
    
    // Validate input
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (!category || category.trim() === '') {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!price || isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }
    
    // Get existing columns
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    
    // Build query based on existing columns
    let fields = ['name', 'category', 'price'];
    let values = [name.trim(), category.trim(), price];
    let paramCount = 4;
    
    if (existingColumns.includes('restaurant_id') && restaurantId) {
      fields.push('restaurant_id');
      values.push(restaurantId);
    }
    
    if (existingColumns.includes('commission')) {
      fields.push('commission');
      values.push(commission || 0);
    }
    
    if (existingColumns.includes('status')) {
      fields.push('status');
      values.push(status || 'Active');
    }
    
    if (existingColumns.includes('images')) {
      fields.push('images');
      values.push(images || []);
    }
    
    if (existingColumns.includes('variants')) {
      fields.push('variants');
      values.push(variants || []);
    }
    
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO products (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    
    console.log('Create Product Query:', query);
    console.log('Create Product Values:', values);
    
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product', details: err.message });
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
    
    // Validate input
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
    
    // Get existing columns
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    
    // Build update query based on existing columns
    let updates = [];
    let values = [];
    let paramCount = 1;
    
    updates.push(`name = $${paramCount++}`);
    values.push(name.trim());
    
    updates.push(`category = $${paramCount++}`);
    values.push(category.trim());
    
    updates.push(`price = $${paramCount++}`);
    values.push(price);
    
    if (existingColumns.includes('restaurant_id')) {
      updates.push(`restaurant_id = $${paramCount++}`);
      values.push(restaurantId || null);
    }
    
    if (existingColumns.includes('commission')) {
      updates.push(`commission = $${paramCount++}`);
      values.push(commission || 0);
    }
    
    if (existingColumns.includes('status')) {
      updates.push(`status = $${paramCount++}`);
      values.push(status || 'Active');
    }
    
    if (existingColumns.includes('images')) {
      updates.push(`images = $${paramCount++}`);
      values.push(images || []);
    }
    
    if (existingColumns.includes('variants')) {
      updates.push(`variants = $${paramCount++}`);
      values.push(variants || []);
    }
    
    values.push(id);
    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    
    console.log('Update Product Query:', query);
    console.log('Update Product Values:', values);
    
    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product', details: err.message });
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if product exists
    const exists = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product', details: err.message });
  }
};