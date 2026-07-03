const pool = require('../db');

exports.getAllOffers = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM offers');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createOffer = async (req, res) => {
  const { title, discount, code, bg, icon } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO offers (title, discount, code, bg, icon) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, discount, code, bg, icon]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateOffer = async (req, res) => {
  const { id } = req.params;
  const { title, discount, code, bg, icon } = req.body;
  try {
    const result = await pool.query(
      'UPDATE offers SET title=$1, discount=$2, code=$3, bg=$4, icon=$5 WHERE id=$6 RETURNING *',
      [title, discount, code, bg, icon, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Offer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteOffer = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM offers WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};