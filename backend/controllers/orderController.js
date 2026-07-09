const pool = require('../db');

// Helper: send WhatsApp and log result
async function sendWhatsApp(phone, message, orderId, recipientType) {
  const cleanPhone = phone.replace(/\D/g, '');
  let status = 'failed';
  let errorMsg = null;

  try {
    // Replace with actual WhatsApp API (Twilio, 2Factor, etc.)
    console.log(`📱 WhatsApp to ${cleanPhone}: ${message}`);
    status = 'sent';
  } catch (err) {
    errorMsg = err.message;
    status = 'failed';
  }

  await pool.query(
    `INSERT INTO whatsapp_logs (order_id, recipient_phone, recipient_type, status, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, cleanPhone, recipientType, status, errorMsg]
  );

  return { status, error: errorMsg };
}

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
    const createdOrder = result.rows[0];

    // Fetch active admin phone
    const settingsResult = await pool.query("SELECT value FROM settings WHERE key = 'active_admin_phone'");
    let adminPhone = settingsResult.rows[0]?.value || process.env.ADMIN_PHONES?.split(',')[0] || '+919019825189';

    const userResult = await pool.query('SELECT phone FROM users WHERE id = $1', [customerId]);
    const userPhone = userResult.rows[0]?.phone;

    if (userPhone) {
      const userMsg = `🎉 Thank you for your order!\nOrder #${orderId}\nItems: ${items.map(i => `${i.name}×${i.quantity}`).join(', ')}\nTotal: ₹${grandTotal}\nDelivery Address: ${deliveryAddress}\n\nThank you for shopping with CaptaDelivery! ❤️`;
      await sendWhatsApp(userPhone, userMsg, orderId, 'user');
    }

    const adminMsg = `📊 New Order #${orderId}\nCustomer: ${userPhone || 'Guest'}\nItems: ${items.map(i => `${i.name}×${i.quantity}`).join(', ')}\nTotal: ₹${grandTotal}\nAddress: ${deliveryAddress}`;
    await sendWhatsApp(adminPhone, adminMsg, orderId, 'admin');

    res.status(201).json(createdOrder);
  } catch (err) {
    console.error('Order creation error:', err);
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