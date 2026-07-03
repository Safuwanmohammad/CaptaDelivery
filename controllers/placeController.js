const pool = require('../db');

exports.getAllPlaces = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM places');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPlace = async (req, res) => {
  const { area, subArea, charge, minOrder, time, status } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO places (area, sub_area, charge, min_order, time, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [area, subArea, charge, minOrder, time, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePlace = async (req, res) => {
  const { id } = req.params;
  const { area, subArea, charge, minOrder, time, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE places SET area=$1, sub_area=$2, charge=$3, min_order=$4, time=$5, status=$6
       WHERE id=$7 RETURNING *`,
      [area, subArea, charge, minOrder, time, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Place not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePlace = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM places WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};