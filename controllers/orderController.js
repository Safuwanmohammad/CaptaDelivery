const pool = require('../db');

exports.getAllOrders = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createOrder = async (req, res) => {
  const { orderId, customerId, items, productTotal, deliveryCharge, commissionAmount, adminProfit, grandTotal, paymentMethod, paymentStatus, status, deliveryAddress } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO orders (order_id, customer_id, items, product_total, delivery_charge, commission_amount, admin_profit, grand_total, payment_method, payment_status, status, delivery_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [orderId, customerId, items, productTotal, deliveryCharge, commissionAmount, adminProfit, grandTotal, paymentMethod, paymentStatus, status, deliveryAddress]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};