const pool = require('../db');

exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { blocked, total_orders, total_spent, last_order } = req.body;
  try {
    let query = 'UPDATE users SET';
    const params = [];
    let paramIndex = 1;
    
    if (blocked !== undefined) {
      query += ` blocked = $${paramIndex},`;
      params.push(blocked);
      paramIndex++;
    }
    if (total_orders !== undefined) {
      query += ` total_orders = $${paramIndex},`;
      params.push(total_orders);
      paramIndex++;
    }
    if (total_spent !== undefined) {
      query += ` total_spent = $${paramIndex},`;
      params.push(total_spent);
      paramIndex++;
    }
    if (last_order !== undefined) {
      query += ` last_order = $${paramIndex},`;
      params.push(last_order);
      paramIndex++;
    }
    
    // Remove trailing comma
    query = query.slice(0, -1);
    query += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};