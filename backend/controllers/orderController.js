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
  const { 
    orderId, customerId, items, productTotal, deliveryCharge, 
    rainFare, commissionAmount, adminProfit, grandTotal, 
    paymentMethod, paymentStatus, status, deliveryAddress 
  } = req.body;
  
  try {
    // Calculate category-wise commission
    let categoryCommission = {};
    let totalCommission = 0;
    
    items.forEach(item => {
      const cat = item.category || 'Uncategorized';
      const commission = (item.price * item.quantity * (item.commission || 0)) / 100;
      if (!categoryCommission[cat]) {
        categoryCommission[cat] = 0;
      }
      categoryCommission[cat] += commission;
      totalCommission += commission;
    });

    const result = await pool.query(
      `INSERT INTO orders (
        order_id, customer_id, items, product_total, delivery_charge, 
        rain_fare, commission_amount, admin_profit, grand_total, 
        payment_method, payment_status, status, delivery_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [orderId, customerId, items, productTotal, deliveryCharge, 
       rainFare, totalCommission, adminProfit, grandTotal, 
       paymentMethod, paymentStatus, status, deliveryAddress]
    );
    
    const order = result.rows[0];
    
    // Get customer details
    const customerResult = await pool.query('SELECT * FROM users WHERE id = $1', [customerId]);
    const customer = customerResult.rows[0];
    
    // Get admin phone numbers
    const adminPhonesResult = await pool.query("SELECT value FROM settings WHERE key = 'admin_phones'");
    let adminPhones = [];
    if (adminPhonesResult.rows.length > 0) {
      try {
        adminPhones = JSON.parse(adminPhonesResult.rows[0].value);
      } catch (e) {
        adminPhones = ['+919019825189', '+91827079552', '+919999999999'];
      }
    }
    
    // Send WhatsApp notifications (async, don't wait)
    if (customer && customer.phone) {
      // Send to customer
      sendOrderWhatsApp({
        orderId,
        customerPhone: customer.phone,
        customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer',
        orderTotal: grandTotal,
        deliveryAddress,
        items,
        categoryCommission,
        totalCommission,
        deliveryCharge,
        rainFare,
        type: 'customer'
      });
      
      // Send to all admin phones
      adminPhones.forEach(adminPhone => {
        sendOrderWhatsApp({
          orderId,
          customerPhone: adminPhone,
          customerName: `Admin (${adminPhone})`,
          orderTotal: grandTotal,
          deliveryAddress,
          items,
          categoryCommission,
          totalCommission,
          deliveryCharge,
          rainFare,
          type: 'admin',
          adminPhone: adminPhone
        });
      });
    }
    
    res.status(201).json(order);
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
    
    // Send status update WhatsApp
    const order = result.rows[0];
    const customerResult = await pool.query('SELECT * FROM users WHERE id = $1', [order.customer_id]);
    const customer = customerResult.rows[0];
    
    if (customer && customer.phone) {
      sendStatusUpdateWhatsApp({
        orderId: order.order_id,
        customerPhone: customer.phone,
        customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer',
        status: status,
        orderTotal: order.grand_total
      });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Helper function to send WhatsApp messages
async function sendOrderWhatsApp(data) {
  const { orderId, customerPhone, customerName, orderTotal, deliveryAddress, items, categoryCommission, totalCommission, deliveryCharge, rainFare, type, adminPhone } = data;
  
  try {
    let phone = customerPhone.trim();
    if (!phone.startsWith('+')) {
      phone = '+91' + phone;
    }
    
    let message = '';
    
    if (type === 'admin') {
      // Admin bill with category-wise commission
      message = `🧾 *ORDER BILL - Admin Copy*\n\n`;
      message += `📋 *Order ID:* ${orderId}\n`;
      message += `👤 *Customer:* ${customerName}\n`;
      message += `📍 *Delivery:* ${deliveryAddress || 'N/A'}\n\n`;
      message += `📦 *Items:*\n`;
      items.forEach(item => {
        const displayName = item.displayName || item.name;
        const itemTotal = (item.price || 0) * item.quantity;
        message += `  • ${displayName} x${item.quantity} = ₹${itemTotal}\n`;
      });
      message += `\n💰 *Category-wise Commission:*\n`;
      let grandTotal = 0;
      Object.keys(categoryCommission).forEach(cat => {
        message += `  • ${cat}: ₹${categoryCommission[cat].toFixed(2)}\n`;
        grandTotal += categoryCommission[cat];
      });
      message += `\n📊 *Total Commission:* ₹${totalCommission.toFixed(2)}\n`;
      message += `🚚 *Delivery Charge:* ₹${deliveryCharge || 0}\n`;
      message += `🌧️ *Rain Fare:* ₹${rainFare || 0}\n`;
      message += `\n💵 *Grand Total:* ₹${orderTotal}\n`;
      message += `\n📱 *Admin Phone:* ${adminPhone || phone}\n`;
      message += `\n🕐 ${new Date().toLocaleString()}`;
    } else {
      // Customer bill
      message = `🛍️ *Order Confirmation - CaptaDelivery*\n\n`;
      message += `📋 *Order ID:* ${orderId}\n`;
      message += `👤 *Customer:* ${customerName}\n`;
      message += `📍 *Delivery:* ${deliveryAddress || 'N/A'}\n\n`;
      message += `📦 *Items:*\n`;
      items.forEach(item => {
        const displayName = item.displayName || item.name;
        message += `  • ${displayName} x${item.quantity} = ₹${(item.price || 0) * item.quantity}\n`;
      });
      message += `\n🚚 *Delivery Charge:* ₹${deliveryCharge || 0}\n`;
      message += `🌧️ *Rain Fare:* ₹${rainFare || 0}\n`;
      message += `\n💵 *Grand Total:* ₹${orderTotal}\n`;
      message += `\nThank you for ordering with CaptaDelivery! 🚀\n`;
      message += `We'll deliver your order soon.`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;

    // Log the WhatsApp notification
    await pool.query(
      `INSERT INTO whatsapp_logs (order_id, recipient_phone, recipient_type, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, phone, type, 'sent', null]
    );

    console.log(`✅ WhatsApp ${type} notification prepared for ${phone}`);
    console.log(`📱 URL: ${whatsappUrl}`);
    
    return { success: true, whatsappUrl };
  } catch (err) {
    console.error('WhatsApp error:', err);
    await pool.query(
      `INSERT INTO whatsapp_logs (order_id, recipient_phone, recipient_type, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, customerPhone, type, 'failed', err.message]
    );
    return { success: false, error: err.message };
  }
}

async function sendStatusUpdateWhatsApp(data) {
  const { orderId, customerPhone, customerName, status, orderTotal } = data;
  
  try {
    let phone = customerPhone.trim();
    if (!phone.startsWith('+')) {
      phone = '+91' + phone;
    }
    
    const statusEmojis = {
      'Pending': '⏳',
      'Processing': '🔄',
      'Delivered': '✅',
      'Cancelled': '❌'
    };
    
    const message = `📦 *Order Status Update - CaptaDelivery*\n\n`;
    message += `📋 *Order ID:* ${orderId}\n`;
    message += `👤 *Customer:* ${customerName}\n`;
    message += `💰 *Total:* ₹${orderTotal}\n`;
    message += `📊 *Status:* ${statusEmojis[status] || ''} ${status}\n\n`;
    message += `Thank you for choosing CaptaDelivery! 🚀`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;

    await pool.query(
      `INSERT INTO whatsapp_logs (order_id, recipient_phone, recipient_type, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, phone, 'status_update', 'sent', null]
    );

    console.log(`✅ Status update WhatsApp prepared for ${phone}`);
    return { success: true, whatsappUrl };
  } catch (err) {
    console.error('Status update WhatsApp error:', err);
    return { success: false, error: err.message };
  }
}