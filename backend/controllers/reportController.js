const pool = require('../db');

exports.getCommissionReport = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    let interval;
    if (period === 'weekly') interval = '7 days';
    else if (period === 'monthly') interval = '30 days';
    else interval = '1 day';

    const query = `
      SELECT
        DATE_TRUNC('day', date) AS day,
        COUNT(*) AS orders,
        SUM(grand_total) AS sales,
        SUM(commission_amount) AS commission
      FROM orders
      WHERE status = 'Delivered'
        AND date > NOW() - INTERVAL '${interval}'
      GROUP BY day
      ORDER BY day ASC
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
    res.status(500).json({ error: err.message });
  }
};

exports.getRestaurantReport = async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    const query = `
      SELECT
        o.order_id,
        o.date,
        o.grand_total,
        o.commission_amount,
        o.delivery_charge,
        o.rain_fare,
        o.items
      FROM orders o
      WHERE o.status = 'Delivered'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(o.items) AS item
          WHERE (item->>'restaurant_id')::int = $1
        )
      ORDER BY o.date DESC
    `;
    const result = await pool.query(query, [restaurantId]);

    let totalRevenue = 0;
    let totalCommission = 0;
    let ordersDetail = result.rows.map(row => {
      const grandTotal = parseFloat(row.grand_total);
      const commission = parseFloat(row.commission_amount) || 0;
      const delivery = parseFloat(row.delivery_charge) || 0;
      const rain = parseFloat(row.rain_fare) || 0;
      const restaurantRevenue = grandTotal - commission - delivery - rain;
      totalRevenue += grandTotal;
      totalCommission += commission;
      return {
        orderId: row.order_id,
        date: row.date,
        grandTotal,
        commission,
        delivery,
        rain,
        restaurantRevenue
      };
    });

    res.json({
      totalOrders: result.rows.length,
      totalRevenue,
      totalCommission,
      restaurantRevenue: totalRevenue - totalCommission - 
        ordersDetail.reduce((s, o) => s + (o.delivery || 0) + (o.rain || 0), 0),
      orders: ordersDetail
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.toggleRestaurantStatus = async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
};

// NEW: Get category-wise commission report
exports.getCategoryCommissionReport = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    let interval;
    if (period === 'weekly') interval = '7 days';
    else if (period === 'monthly') interval = '30 days';
    else interval = '1 day';

    // Get all delivered orders in the period
    const query = `
      SELECT items, commission_amount, grand_total
      FROM orders
      WHERE status = 'Delivered'
        AND date > NOW() - INTERVAL '${interval}'
    `;
    const result = await pool.query(query);
    
    // Calculate category-wise commission
    const categoryCommission = {};
    let totalCommission = 0;
    let totalOrders = result.rows.length;
    let totalRevenue = 0;
    
    result.rows.forEach(row => {
      totalRevenue += parseFloat(row.grand_total) || 0;
      totalCommission += parseFloat(row.commission_amount) || 0;
      
      const items = row.items || [];
      items.forEach(item => {
        const cat = item.category || 'Uncategorized';
        const commission = (item.price || 0) * (item.quantity || 0) * (item.commission || 0) / 100;
        if (!categoryCommission[cat]) {
          categoryCommission[cat] = 0;
        }
        categoryCommission[cat] += commission;
      });
    });
    
    // Format for chart
    const labels = Object.keys(categoryCommission);
    const data = Object.values(categoryCommission);
    
    res.json({
      labels,
      data,
      categoryCommission,
      totalCommission,
      totalOrders,
      totalRevenue
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};