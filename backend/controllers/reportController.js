const pool = require('../db');

// Get commission reports aggregated by period
exports.getCommissionReport = async (req, res) => {
  const { period } = req.query; // 'daily', 'weekly', 'monthly'
  let interval;
  const now = new Date();
  let startDate;

  switch (period) {
    case 'weekly':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      interval = 'day';
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      interval = 'day';
      break;
    case 'daily':
    default:
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      interval = 'hour';
      break;
  }

  try {
    const result = await pool.query(
      `SELECT 
        date_trunc($1, date) as period_date,
        SUM(commission_amount) as total_commission,
        SUM(grand_total) as total_sales,
        COUNT(*) as order_count
       FROM orders
       WHERE status = 'Delivered' AND date >= $2
       GROUP BY period_date
       ORDER BY period_date ASC`,
      [interval, startDate]
    );

    const labels = result.rows.map(r => new Date(r.period_date).toLocaleDateString());
    const commissionData = result.rows.map(r => parseFloat(r.total_commission) || 0);
    const salesData = result.rows.map(r => parseFloat(r.total_sales) || 0);
    const orderCounts = result.rows.map(r => parseInt(r.order_count) || 0);

    res.json({
      period,
      labels,
      commissionData,
      salesData,
      orderCounts,
      totalCommission: commissionData.reduce((a, b) => a + b, 0),
      totalSales: salesData.reduce((a, b) => a + b, 0),
      totalOrders: orderCounts.reduce((a, b) => a + b, 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get report for a specific restaurant
exports.getRestaurantReport = async (req, res) => {
  const { id } = req.params;
  try {
    // Since items JSONB may not have restaurant_id, we need to get orders that contain items from this restaurant.
    // We'll query orders where any item has the restaurant_id.
    // We'll use a JSONB query that checks if any item in the items array has restaurant_id = id
    const result = await pool.query(
      `SELECT 
        o.order_id,
        o.date,
        o.grand_total,
        o.commission_amount,
        o.delivery_charge,
        o.rain_fare,
        (o.grand_total - o.commission_amount - o.delivery_charge - o.rain_fare) as restaurant_revenue,
        o.items
       FROM orders o
       WHERE o.status = 'Delivered'
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(o.items) as item
           WHERE item->>'restaurant_id' = $1::text
         )
       ORDER BY o.date DESC`,
      [id.toString()]
    );

    const orders = result.rows;
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.grand_total || 0), 0);
    const totalCommission = orders.reduce((s, o) => s + parseFloat(o.commission_amount || 0), 0);
    const totalDelivery = orders.reduce((s, o) => s + parseFloat(o.delivery_charge || 0), 0);
    const totalRain = orders.reduce((s, o) => s + parseFloat(o.rain_fare || 0), 0);
    const restaurantRevenue = orders.reduce((s, o) => s + parseFloat(o.restaurant_revenue || 0), 0);

    res.json({
      restaurantId: id,
      totalOrders,
      totalRevenue,
      totalCommission,
      totalDelivery,
      totalRain,
      restaurantRevenue,
      orders: orders.map(o => ({
        orderId: o.order_id,
        date: o.date,
        grandTotal: o.grand_total,
        commission: o.commission_amount,
        restaurantRevenue: o.restaurant_revenue
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Toggle restaurant status
exports.toggleRestaurantStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'Active' or 'Inactive'
  try {
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