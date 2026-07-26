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
  
  // Get the last order number for today
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
// SEND WHATSAPP MESSAGE VIA CLOUD API
// ============================================================
async function sendWhatsAppMessage(to, templateName, components = []) {
  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    
    if (!phoneNumberId || !accessToken) {
      console.warn('⚠️ WhatsApp credentials not configured');
      return { success: false, error: 'WhatsApp not configured' };
    }
    
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: components
      }
    };
    
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ WhatsApp message sent to ${to}:`, response.data);
    return { success: true, data: response.data };
  } catch (err) {
    console.error('❌ WhatsApp send error:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// SEND CUSTOM WHATSAPP TEXT MESSAGE
// ============================================================
async function sendWhatsAppText(to, message) {
  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    
    if (!phoneNumberId || !accessToken) {
      console.warn('⚠️ WhatsApp credentials not configured');
      return { success: false, error: 'WhatsApp not configured' };
    }
    
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: message }
    };
    
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ WhatsApp text sent to ${to}`);
    return { success: true, data: response.data };
  } catch (err) {
    console.error('❌ WhatsApp text error:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
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
  
  // Group items by category
  const groupedItems = {};
  (order.items || []).forEach(item => {
    const cat = item.category || 'Uncategorized';
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(item);
  });
  
  // Calculate category totals
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
  
  // Build invoice text
  let invoice = '🛒 *CaptaDelivery*\n';
  invoice += '━━━━━━━━━━━━━━━━━━━━\n\n';
  invoice += `📋 *Order Number:* ${order.order_number || order.order_id}\n`;
  invoice += `📅 *Date:* ${dateStr}\n`;
  invoice += `⏰ *Time:* ${timeStr}\n`;
  invoice += `💳 *Payment:* ${order.payment_method || 'COD'}\n`;
  invoice += `📍 *Delivery:* ${order.delivery_address || 'N/A'}\n\n`;
  invoice += '━━━━━━━━━━━━━━━━━━━━\n';
  
  // Products by category
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
  
  // Only show rain fare if enabled and > 0
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
  
  // Group items by category
  const groupedItems = {};
  (order.items || []).forEach(item => {
    const cat = item.category || 'Uncategorized';
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(item);
  });
  
  // Calculate category totals and commissions
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
  
  // Build admin invoice
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
  
  // Products by category with commission
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
// SEND INVOICES VIA WHATSAPP
// ============================================================
async function sendOrderInvoices(order, customer) {
  const customerPhone = customer?.phone;
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || '+919019825189';
  
  const results = [];
  
  // Send customer invoice
  if (customerPhone) {
    const customerInvoice = generateCustomerInvoice(order, customer);
    const result = await sendWhatsAppText(customerPhone, customerInvoice);
    results.push({ recipient: customerPhone, type: 'customer', ...result });
    
    // Log to database
    await pool.query(
      `INSERT INTO whatsapp_logs (order_id, recipient_phone, recipient_type, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.order_id || order.id, customerPhone, 'customer', 
       result.success ? 'sent' : 'failed', 
       result.success ? null : result.error]
    );
  }
  
  // Send admin invoice
  if (adminPhone) {
    const adminInvoice = generateAdminInvoice(order, customer);
    const result = await sendWhatsAppText(adminPhone, adminInvoice);
    results.push({ recipient: adminPhone, type: 'admin', ...result });
    
    // Log to database
    await pool.query(
      `INSERT INTO whatsapp_logs (order_id, recipient_phone, recipient_type, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.order_id || order.id, adminPhone, 'admin',
       result.success ? 'sent' : 'failed',
       result.success ? null : result.error]
    );
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
    // Generate unique order number
    const orderNumber = await generateOrderNumber();
    
    // Calculate category-wise commission
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
        orderNumber, // order_id also uses the same number
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
    
    // Get customer details
    const customerResult = await pool.query('SELECT * FROM users WHERE id = $1', [customerId]);
    const customer = customerResult.rows[0];
    
    // Update customer stats
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
    
    // Send status update via WhatsApp
    if (customer && customer.phone) {
      const statusMsg = `📦 *Order Status Update - CaptaDelivery*\n\n` +
        `📋 *Order Number:* ${order.order_number || order.order_id}\n` +
        `👤 *Customer:* ${customer.first_name || ''} ${customer.last_name || ''}\n` +
        `📊 *Status:* ${status}\n\n` +
        `Thank you for choosing CaptaDelivery! 🚀`;
      
      await sendWhatsAppText(customer.phone, statusMsg);
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
exports.sendWhatsAppText = sendWhatsAppText;
exports.generateCustomerInvoice = generateCustomerInvoice;
exports.generateAdminInvoice = generateAdminInvoice;