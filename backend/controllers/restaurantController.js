const pool = require('../db');

exports.getAllRestaurants = async (req, res) => {
  try {
    console.log('[Restaurants] Fetching all...');
    const result = await pool.query('SELECT * FROM restaurants ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('[Restaurants] Error:', err);
    res.status(500).json({ error: 'Failed to fetch restaurants', details: err.message });
  }
};

exports.getRestaurantById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createRestaurant = async (req, res) => {
  try {
    const { name, category, logo, status } = req.body;
    const result = await pool.query(
      'INSERT INTO restaurants (name, category, logo, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, category, logo || 'https://placehold.co/100', status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, logo, status } = req.body;
    const result = await pool.query(
      'UPDATE restaurants SET name=$1, category=$2, logo=$3, status=$4 WHERE id=$5 RETURNING *',
      [name, category, logo, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM restaurants WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};