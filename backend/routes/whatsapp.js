const express = require('express');
const router = express.Router();
const pool = require('../db');

// Send WhatsApp notification for an order
router.post('/send-order-notification', async (req, res) => {
  const { orderId, customerPhone, customerName, orderTotal, deliveryAddress } = req.body;
  
  if (!orderId || !customerPhone) {
    return res.status(400).json({ error: 'Order ID and customer phone are required' });
  }

  try {
    // Format phone number (remove spaces, add +91 if needed)
    let phone = customerPhone.trim();
    if (!phone.startsWith('+')) {
      phone = '+91' + phone;
    }

    // Build the WhatsApp message
    const message = `🛍️ *Order Confirmation - CaptaDelivery*
    
📋 *Order ID:* ${orderId}
👤 *Customer:* ${customerName || 'Customer'}
📦 *Total:* ₹${orderTotal || '0'}
📍 *Delivery:* ${deliveryAddress || 'N/A'}

Thank you for ordering with CaptaDelivery! 🚀
We'll deliver your order soon.`;

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;

    // Log the WhatsApp notification
    await pool.query(
      `INSERT INTO whatsapp_logs (order_id, recipient_phone, recipient_type, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, phone, 'customer', 'sent', null]
    );

    res.json({
      success: true,
      message: 'WhatsApp notification prepared',
      whatsappUrl,
      phone
    });

  } catch (err) {
    console.error('WhatsApp error:', err);
    // Log the error
    await pool.query(
      `INSERT INTO whatsapp_logs (order_id, recipient_phone, recipient_type, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, customerPhone, 'customer', 'failed', err.message]
    );
    res.status(500).json({ error: err.message });
  }
});

// Get WhatsApp logs
router.get('/logs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM whatsapp_logs ORDER BY sent_at DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;