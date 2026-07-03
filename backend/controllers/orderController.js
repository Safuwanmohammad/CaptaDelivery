const pool = require('../db');

// ----- Helper to send WhatsApp (simulated) -----
async function sendWhatsAppMessage(to, message) {
  // Replace this with your WhatsApp API (e.g., Twilio, 2Factor WhatsApp, etc.)
  console.log(`📱 WhatsApp to ${to}: ${message}`);
}

// ----- Get all orders -----
exports.getAllOrders = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----- Create order + send WhatsApp notifications -----
exports.createOrder = async (req, res) => {
  const { orderId, customerId, items, productTotal, deliveryCharge, commissionAmount, adminProfit, grandTotal, paymentMethod, paymentStatus, status, deliveryAddress } = req.body;

  try {
    // Insert order
    const result = await pool.query(
      `INSERT INTO orders (order_id, customer_id, items, product_total, delivery_charge, commission_amount, admin_profit, grand_total, payment_method, payment_status, status, delivery_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [orderId, customerId, items, productTotal, deliveryCharge, commissionAmount, adminProfit, grandTotal, paymentMethod, paymentStatus, status, deliveryAddress]
    );
    const createdOrder = result.rows[0];

    // ----- Fetch active admin phone from settings -----
    const settingsResult = await pool.query("SELECT value FROM settings WHERE key = 'active_admin_phone'");
    let adminPhone = settingsResult.rows[0]?.value || process.env.ADMIN_PHONE || '+919019825189';

    // ----- Fetch user phone -----
    const userResult = await pool.query('SELECT phone FROM users WHERE id = $1', [customerId]);
    const userPhone = userResult.rows[0]?.phone;

    // ----- Send WhatsApp to user -----
    if (userPhone) {
      const userMsg = `🎉 Thank you for your order!\nOrder #${orderId}\nItems: ${items.map(i => `${i.name}×${i.quantity}`).join(', ')}\nTotal: ₹${grandTotal}\nDelivery Address: ${deliveryAddress}\n\nThank you for shopping with CaptaDelivery! ❤️`;
      await sendWhatsAppMessage(userPhone, userMsg);
    }

    // ----- Send WhatsApp to admin -----
    const adminMsg = `📊 New Order #${orderId}\nCustomer: ${userPhone || 'Guest'}\nItems: ${items.map(i => `${i.name}×${i.quantity}`).join(', ')}\nTotal: ₹${grandTotal}\nDelivery Address: ${deliveryAddress}`;
    await sendWhatsAppMessage(adminPhone, adminMsg);

    res.status(201).json(createdOrder);
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ----- Update order status -----
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