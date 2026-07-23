const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET commission report
router.get('/commission', async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    let interval;
    if (period === 'weekly') interval = '7 days';
    else if (period === 'monthly') interval = '30 days';
    else interval = '1 day';
    
    const query = `
      SELECT DATE_TRUNC('day', date) AS day, 
             COUNT(*) AS orders,
             SUM(grand_total) AS sales, 
             SUM(commission_amount) AS commission
      FROM orders 
      WHERE status = 'Delivered' AND date > NOW() - INTERVAL '${interval}'
      GROUP BY day ORDER BY day ASC
    `;
    const result = await pool.query(query);
    
    const labels = result.rows.map(row => row.day.toLocaleDateString());
    const orderCounts = result.rows.map(row => parseInt(row.orders));
    const salesData = result.rows.map(row => parseFloat(row.sales));
    const commissionData = result.rows.map(row => parseFloat(row.commission));
    const totalCommission = commissionData.reduce((a, b) => a + b, 0);
    const totalSales = salesData.reduce((a, b) => a + b, 0);
    const totalOrders = orderCounts.reduce((a, b) => a + b, 0);
    
    res.json({ 
      labels, 
      orderCounts, 
      salesData, 
      commissionData, 
      totalCommission, 
      totalSales, 
      totalOrders 
    });
  } catch (err) {
    console.error('Error in commission report:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET restaurant report
router.get('/restaurant/:id', async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    const query = `
      SELECT o.order_id, o.date, o.grand_total, o.commission_amount, 
             o.delivery_charge, o.rain_fare, o.items
      FROM orders o 
      WHERE o.status = 'Delivered'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(o.items) AS item 
        WHERE (item->>'restaurant_id')::int = $1
      )
      ORDER BY o.date DESC
    `;
    const result = await pool.query(query, [restaurantId]);
    
    let totalRevenue = 0, totalCommission = 0;
    const ordersDetail = result.rows.map(row => {
      const grandTotal = parseFloat(row.grand_total);
      const commission = parseFloat(row.commission_amount) || 0;
      const delivery = parseFloat(row.delivery_charge) || 0;
      const rain = parseFloat(row.rain_fare) || 0;
      totalRevenue += grandTotal;
      totalCommission += commission;
      return { 
        orderId: row.order_id, 
        date: row.date, 
        grandTotal, 
        commission, 
        delivery, 
        rain, 
        restaurantRevenue: grandTotal - commission - delivery - rain 
      };
    });
    
    res.json({ 
      totalOrders: result.rows.length, 
      totalRevenue, 
      totalCommission, 
      restaurantRevenue: totalRevenue - totalCommission - ordersDetail.reduce((s, o) => s + (o.delivery || 0) + (o.rain || 0), 0), 
      orders: ordersDetail 
    });
  } catch (err) {
    console.error('Error in restaurant report:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT toggle restaurant status
router.put('/restaurant/:id/toggle', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "Active" or "Inactive"' });
    }
    
    const result = await pool.query(
      'UPDATE restaurants SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in toggle restaurant:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET category commission
router.get('/category-commission', async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    let interval;
    if (period === 'weekly') interval = '7 days';
    else if (period === 'monthly') interval = '30 days';
    else interval = '1 day';
    
    const query = `
      SELECT items, commission_amount, grand_total 
      FROM orders 
      WHERE status = 'Delivered' AND date > NOW() - INTERVAL '${interval}'
    `;
    const result = await pool.query(query);
    
    const categoryCommission = {};
    let totalCommission = 0, totalOrders = result.rows.length, totalRevenue = 0;
    
    result.rows.forEach(row => {
      totalRevenue += parseFloat(row.grand_total) || 0;
      totalCommission += parseFloat(row.commission_amount) || 0;
      const items = row.items || [];
      items.forEach(item => {
        const cat = item.category || 'Uncategorized';
        const commission = (item.price || 0) * (item.quantity || 0) * (item.commission || 0) / 100;
        categoryCommission[cat] = (categoryCommission[cat] || 0) + commission;
      });
    });
    
    const labels = Object.keys(categoryCommission);
    const data = Object.values(categoryCommission);
    
    res.json({ labels, data, categoryCommission, totalCommission, totalOrders, totalRevenue });
  } catch (err) {
    console.error('Error in category commission:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;