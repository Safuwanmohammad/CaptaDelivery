const pool = require('../db');

exports.getAllCategories = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createCategory = async (req, res) => {
  const { name, image } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING *',
      [name, image]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, image } = req.body;
  try {
    const result = await pool.query(
      'UPDATE categories SET name=$1, image=$2 WHERE id=$3 RETURNING *',
      [name, image, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};