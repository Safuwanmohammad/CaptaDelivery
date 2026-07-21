const pool = require('../db');

// Get all products with restaurant details
exports.getAllProducts = async (req, res) => {
  try {
    console.log('[Products] Fetching all products...');
    
    // First check what columns exist
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    const existingColumns = columnsResult.rows.map(r => r.column_name);
    console.log('[Products] Existing columns:', existingColumns);
    
    // Build SELECT query based on existing columns
    let selectFields = ['p.id', 'p.name', 'p.price', 'p.category', 'p.restaurant_id', 'p.commission', 'p.status'];
    if (existingColumns.includes('images')) selectFields.push('p.images');
    if (existingColumns.includes('variants')) selectFields.push('p.variants');
    if (existingColumns.includes('created_at')) selectFields.push('p.created_at');
    
    const query = `
      SELECT ${selectFields.join(', ')}, r.name as restaurant_name
      FROM products p
      LEFT JOIN restaurants r ON p.restaurant_id = r.id
      ORDER BY p.id
    `;
    
    const result = await pool.query(query);
    
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
    console.log('[Products] Creating:', { name, category, restaurantId, price });
    
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
    
    // Check what columns exist
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    const existingColumns = columnsResult.rows.map(r => r.column_name);
    
    // Build INSERT query based on existing columns
    let fields = ['name', 'category', 'restaurant_id', 'price', 'commission', 'status'];
    let values = [name.trim(), category.trim(), restaurantId || null, price, commission || 0, status || 'Active'];
    
    if (existingColumns.includes('images')) {
      fields.push('images');
      values.push(images || []);
    }
    
    if (existingColumns.includes('variants')) {
      fields.push('variants');
      const variantsArray = Array.isArray(variants) ? variants : [];
      values.push(JSON.stringify(variantsArray));
    }
    
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO products (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    
    console.log('[Products] Insert Query:', query);
    const result = await pool.query(query, values);
    
    console.log('[Products] Created:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Products] Create error:', err);
    res.status(500).json({ error: 'Failed to create product', details: err.message });
  }
};

// Update a product - COMPLETE FIX
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
    console.log('[Products] Updating:', { id, name });
    
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
    
    // Check what columns exist
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    const existingColumns = columnsResult.rows.map(r => r.column_name);
    console.log('[Products] Existing columns for update:', existingColumns);
    
    // Build UPDATE query based on existing columns
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    // Always update these
    updates.push(`name = $${paramCount++}`);
    values.push(name.trim());
    
    updates.push(`category = $${paramCount++}`);
    values.push(category.trim());
    
    updates.push(`price = $${paramCount++}`);
    values.push(price);
    
    updates.push(`restaurant_id = $${paramCount++}`);
    values.push(restaurantId || null);
    
    updates.push(`commission = $${paramCount++}`);
    values.push(commission || 0);
    
    updates.push(`status = $${paramCount++}`);
    values.push(status || 'Active');
    
    // Only if column exists
    if (existingColumns.includes('images')) {
      updates.push(`images = $${paramCount++}`);
      values.push(images || []);
    }
    
    if (existingColumns.includes('variants')) {
      updates.push(`variants = $${paramCount++}`);
      const variantsArray = Array.isArray(variants) ? variants : [];
      values.push(JSON.stringify(variantsArray));
    }
    
    values.push(id);
    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    
    console.log('[Products] Update Query:', query);
    const result = await pool.query(query, values);
    
    console.log('[Products] Updated:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Products] Update error:', err);
    
    // If the error is about missing column, try a simpler update
    if (err.message && err.message.includes('column')) {
      try {
        console.log('[Products] Retrying with basic update...');
        const { id } = req.params;
        const { name, category, restaurantId, price, commission, status, images } = req.body;
        
        // Basic update without variants
        const result = await pool.query(
          `UPDATE products 
           SET name = $1, category = $2, restaurant_id = $3, price = $4, commission = $5, status = $6, images = $7
           WHERE id = $8 RETURNING *`,
          [name.trim(), category.trim(), restaurantId || null, price, commission || 0, status || 'Active', images || [], id]
        );
        
        console.log('[Products] Updated (basic):', result.rows[0]);
        res.json(result.rows[0]);
      } catch (retryErr) {
        console.error('[Products] Retry error:', retryErr);
        res.status(500).json({ error: 'Failed to update product', details: retryErr.message });
      }
    } else {
      res.status(500).json({ error: 'Failed to update product', details: err.message });
    }
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