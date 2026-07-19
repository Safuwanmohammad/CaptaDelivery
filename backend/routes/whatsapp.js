const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/send-order-notification', async (req, res) => {
  const { orderId, customerPhone, customerName, orderTotal, deliveryAddress } = req.body;
  if (!orderId || !customerPhone) {
    return res.status(400).json({ error: 'Order ID and customer phone are required' });
  }
  try {
    let phone = customerPhone.trim();
    if (!phone.startsWith('+')) {
      phone = '+91' + phone;
    }
    const message = `🛍️ *Order Confirmation - CaptaDelivery*\n\n📋 *Order ID:* ${orderId}\n👤 *Customer:* ${customerName || 'Customer'}\n📦 *Total:* ₹${orderTotal || '0'}\n📍 *Delivery:* ${deliveryAddress || 'N/A'}\n\nThank you for ordering with CaptaDelivery! 🚀`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    await pool.query(
      `INSERT INTO whatsapp_logs (order_id, recipient_phone, recipient_type, status) VALUES ($1, $2, $3, $4)`,
      [orderId, phone, 'customer', 'sent']
    );
    res.json({ success: true, whatsappUrl, phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM whatsapp_logs ORDER BY sent_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;