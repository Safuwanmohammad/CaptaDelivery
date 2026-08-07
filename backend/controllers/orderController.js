const pool = require('../db');
const axios = require('axios');

// ============================================================
// ORDER NUMBER GENERATION
// ============================================================
async function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;
  
  const result = await pool.query(
    `SELECT order_number FROM orders 
     WHERE order_number LIKE $1 
     ORDER BY id DESC LIMIT 1`,
    [`CD${datePrefix}%`]
  );
  
  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].order_number;
    const lastSeq = parseInt(lastNumber.slice(-4));
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }
  
  return `CD${datePrefix}${String(sequence).padStart(4, '0')}`;
}

// ============================================================
// GENERATE WHATSAPP LINK (wa.me) - WORKS WITH ANY NUMBER
// ============================================================
function generateWhatsAppLink(phoneNumber, message) {
  // Remove + if present, wa.me works with or without +
  let phone = phoneNumber.replace('+', '');
  // Remove any spaces
  phone = phone.replace(/\s/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encodedMessage}`;
}

// ============================================================
// GENERATE CUSTOMER INVOICE
// ============================================================
function generateCustomerInvoice(order, customer) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
  const timeStr = now.toLocaleTimeString('en-IN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
  
  const groupedItems = {};
  (order.items || []).forEach(item => {
    const cat = item.category || 'Uncategorized';
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(item);
  });
  
  const categoryTotals = {};
  let subtotal = 0;
  Object.keys(groupedItems).forEach(cat => {
    const total = groupedItems[cat].reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    categoryTotals[cat] = total;
    subtotal += total;
  });
  
  const deliveryCharge = parseFloat(order.delivery_charge) || 0;
  const rainFare = parseFloat(order.rain_fare) || 0;
  const discount = parseFloat(order.discount) || 0;
  const grandTotal = parseFloat(order.grand_total) || 0;
  
  let invoice = '🛒 *CaptaDelivery*\n';
  invoice += '━━━━━━━━━━━━━━━━━━━━\n\n';
  invoice += `📋 *Order Number:* ${order.order_number || order.order_id}\n`;
  invoice += `📅 *Date:* ${dateStr}\n`;
  invoice += `⏰ *Time:* ${timeStr}\n`;
  invoice += `💳 *Payment:* ${order.payment_method || 'COD'}\n`;
  invoice += `📍 *Delivery:* ${order.delivery_address || 'N/A'}\n\n`;
  invoice += '━━━━━━━━━━━━━━━━━━━━\n';
  
  Object.keys(groupedItems).forEach(cat => {
    invoice += `\n*${cat}*\n`;
    groupedItems[cat].forEach(item => {
      const displayName = item.displayName || item.name;
      const price = item.price || 0;
      const qty = item.quantity || 0;
      invoice += `${displayName} ×${qty} ₹${price * qty}\n`;
    });
    invoice += `Subtotal ₹${categoryTotals[cat]}\n`;
  });
  
  invoice += '\n━━━━━━━━━━━━━━━━━━━━\n';
  invoice += `\n📦 *Delivery Charges:* ₹${deliveryCharge}`;
  
  const rainFareEnabled = process.env.RAIN_FARE_ENABLED !== 'false';
  if (rainFareEnabled && rainFare > 0) {
    invoice += `\n🌧️ *Rain Fare:* ₹${rainFare}`;
  }
  
  if (discount > 0) {
    invoice += `\n🎯 *Discount:* -₹${discount}`;
  }
  
  invoice += `\n\n💵 *Grand Total:* ₹${grandTotal}`;
  invoice += '\n\n*Thank you for shopping with CaptaDelivery!*\n';
  invoice += `📞 *Support:* +91 9019825189`;
  
  return invoice;
}

// ============================================================
// GENERATE ADMIN INVOICE
// ============================================================
function generateAdminInvoice(order, customer) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
  const timeStr = now.toLocaleTimeString('en-IN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
  
  const groupedItems = {};
  (order.items || []).forEach(item => {
    const cat = item.category || 'Uncategorized';
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(item);
  });
  
  const categoryData = {};
  let subtotal = 0;
  let totalCommission = 0;
  
  Object.keys(groupedItems).forEach(cat => {
    const items = groupedItems[cat];
    const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    const commission = items.reduce((sum, item) => {
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      const commRate = parseFloat(item.commission) || 0;
      return sum + (itemTotal * commRate / 100);
    }, 0);
    
    categoryData[cat] = { items, total, commission };
    subtotal += total;
    totalCommission += commission;
  });
  
  const deliveryCharge = parseFloat(order.delivery_charge) || 0;
  const rainFare = parseFloat(order.rain_fare) || 0;
  const discount = parseFloat(order.discount) || 0;
  const grandTotal = parseFloat(order.grand_total) || 0;
  
  let invoice = '🧾 *CaptaDelivery - Admin Invoice*\n';
  invoice += '━━━━━━━━━━━━━━━━━━━━\n\n';
  invoice += `📋 *Order Number:* ${order.order_number || order.order_id}\n`;
  invoice += `📅 *Date:* ${dateStr}\n`;
  invoice += `⏰ *Time:* ${timeStr}\n`;
  invoice += `👤 *Customer:* ${customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : 'N/A'}\n`;
  invoice += `📱 *Mobile:* ${customer ? customer.phone : 'N/A'}\n`;
  invoice += `📍 *Delivery:* ${order.delivery_address || 'N/A'}\n`;
  invoice += `💳 *Payment:* ${order.payment_method || 'COD'}\n\n`;
  invoice += '━━━━━━━━━━━━━━━━━━━━\n';
  
  Object.keys(categoryData).forEach(cat => {
    const data = categoryData[cat];
    invoice += `\n*${cat}*\n`;
    data.items.forEach(item => {
      const displayName = item.displayName || item.name;
      const price = item.price || 0;
      const qty = item.quantity || 0;
      invoice += `${displayName} ×${qty} ₹${price * qty}\n`;
    });
    invoice += `Subtotal ₹${data.total}\n`;
    invoice += `Commission ₹${data.commission.toFixed(2)}\n`;
  });
  
  invoice += '\n━━━━━━━━━━━━━━━━━━━━\n';
  invoice += `\n📊 *Subtotal:* ₹${subtotal}`;
  invoice += `\n📦 *Delivery Charges:* ₹${deliveryCharge}`;
  
  const rainFareEnabled = process.env.RAIN_FARE_ENABLED !== 'false';
  if (rainFareEnabled && rainFare > 0) {
    invoice += `\n🌧️ *Rain Fare:* ₹${rainFare}`;
  }
  
  if (discount > 0) {
    invoice += `\n🎯 *Discount:* -₹${discount}`;
  }
  
  invoice += `\n💰 *Total Commission:* ₹${totalCommission.toFixed(2)}`;
  invoice += `\n\n💵 *Grand Total:* ₹${grandTotal}`;
  
  return invoice;
}

// ============================================================
// SEND INVOICES VIA WHATSAPP (wa.me links)
// ============================================================
async function sendOrderInvoices(order, customer) {
  const customerPhone = customer?.phone;
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || '+919019825189';
  
  const results = [];
  
  // Send customer invoice via wa.me link (just generate the link)
  if (customerPhone) {
    const customerInvoice = generateCustomerInvoice(order, customer);
    const whatsappLink = generateWhatsAppLink(customerPhone, customerInvoice);
    
    console.log(`📱 Customer WhatsApp Link: ${whatsappLink}`);
    
    // Log to database
    await pool.query(
      `INSERT INTO whatsapp_logs (order_id, recipient_phone, recipient_type, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.order_id || order.id, customerPhone, 'customer', 
       'link_generated', null]
    );
    
    results.push({ 
      recipient: customerPhone, 
      type: 'customer', 
      success: true, 
      whatsappLink 
    });
  }
  
  // Send admin invoice via wa.me link
  if (adminPhone) {
    const adminInvoice = generateAdminInvoice(order, customer);
    const whatsappLink = generateWhatsAppLink(adminPhone, adminInvoice);
    
    console.log(`📱 Admin WhatsApp Link: ${whatsappLink}`);
    
    await pool.query(
      `INSERT INTO whatsapp_logs (order_id, recipient_phone, recipient_type, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.order_id || order.id, adminPhone, 'admin',
       'link_generated', null]
    );
    
    results.push({ 
      recipient: adminPhone, 
      type: 'admin', 
      success: true, 
      whatsappLink 
    });
  }
  
  return results;
}

// ============================================================
// GET ALL ORDERS
// ============================================================
exports.getAllOrders = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// CREATE ORDER
// ============================================================
exports.createOrder = async (req, res) => {
  const { 
    customerId, items, productTotal, deliveryCharge, 
    rainFare, commissionAmount, adminProfit, grandTotal, 
    paymentMethod, paymentStatus, status, deliveryAddress,
    discount
  } = req.body;
  
  try {
    const orderNumber = await generateOrderNumber();
    
    let categoryCommission = {};
    let totalCommission = 0;
    
    items.forEach(item => {
      const cat = item.category || 'Uncategorized';
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      const commRate = parseFloat(item.commission) || 0;
      const commission = itemTotal * commRate / 100;
      
      if (!categoryCommission[cat]) {
        categoryCommission[cat] = 0;
      }
      categoryCommission[cat] += commission;
      totalCommission += commission;
    });

    const now = new Date();
    const result = await pool.query(
      `INSERT INTO orders (
        order_number, order_id, customer_id, items, product_total, delivery_charge, 
        rain_fare, commission_amount, admin_profit, grand_total, 
        payment_method, payment_status, status, delivery_address, discount,
        created_at, order_date, order_time, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
      [
        orderNumber,
        orderNumber,
        customerId, 
        items, 
        productTotal, 
        deliveryCharge, 
        rainFare || 0, 
        totalCommission, 
        adminProfit, 
        grandTotal, 
        paymentMethod, 
        paymentStatus, 
        status, 
        deliveryAddress,
        discount || 0,
        now,
        now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
        'Asia/Kolkata'
      ]
    );
    
    const order = result.rows[0];
    
    const customerResult = await pool.query('SELECT * FROM users WHERE id = $1', [customerId]);
    const customer = customerResult.rows[0];
    
    if (customer) {
      await pool.query(
        `UPDATE users SET 
          total_orders = total_orders + 1, 
          total_spent = total_spent + $1, 
          last_order = NOW()
         WHERE id = $2`,
        [grandTotal, customerId]
      );
    }
    
    // Send WhatsApp invoices asynchronously (don't wait)
    sendOrderInvoices(order, customer).catch(err => {
      console.error('❌ WhatsApp send error:', err);
    });
    
    res.status(201).json(order);
  } catch (err) {
    console.error('❌ Create order error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// UPDATE ORDER STATUS
// ============================================================
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = result.rows[0];
    const customerResult = await pool.query('SELECT * FROM users WHERE id = $1', [order.customer_id]);
    const customer = customerResult.rows[0];
    
    // Send status update via WhatsApp link
    if (customer && customer.phone) {
      const statusMsg = `📦 *Order Status Update - CaptaDelivery*\n\n` +
        `📋 *Order Number:* ${order.order_number || order.order_id}\n` +
        `👤 *Customer:* ${customer.first_name || ''} ${customer.last_name || ''}\n` +
        `📊 *Status:* ${status}\n\n` +
        `Thank you for choosing CaptaDelivery! 🚀`;
      
      const whatsappLink = generateWhatsAppLink(customer.phone, statusMsg);
      console.log(`📱 Status update link: ${whatsappLink}`);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// SEND WHATSAPP INVOICE (manual trigger)
// ============================================================
exports.sendWhatsAppInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = result.rows[0];
    const customerResult = await pool.query('SELECT * FROM users WHERE id = $1', [order.customer_id]);
    const customer = customerResult.rows[0];
    
    const results = await sendOrderInvoices(order, customer);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// EXPOSE INTERNAL FUNCTIONS FOR TESTING
// ============================================================
exports.generateOrderNumber = generateOrderNumber;
exports.generateWhatsAppLink = generateWhatsAppLink;
exports.generateCustomerInvoice = generateCustomerInvoice;
exports.generateAdminInvoice = generateAdminInvoice;