const pool = require('./db');

const seed = async () => {
  try {
    await pool.query(`
      DROP TABLE IF EXISTS products, restaurants, categories, offers, places, orders, users, settings, whatsapp_logs CASCADE;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        image TEXT
      );

      CREATE TABLE IF NOT EXISTS restaurants (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        logo TEXT,
        status TEXT DEFAULT 'Active'
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE SET NULL,
        price NUMERIC(10,2),
        commission NUMERIC(5,2),
        status TEXT DEFAULT 'Active',
        images TEXT[],
        variants JSONB
      );

      CREATE TABLE IF NOT EXISTS places (
        id SERIAL PRIMARY KEY,
        area TEXT NOT NULL,
        sub_area TEXT NOT NULL,
        charge NUMERIC(10,2),
        min_order NUMERIC(10,2),
        time TEXT,
        status TEXT DEFAULT 'Active'
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        address TEXT,
        pincode TEXT,
        phone TEXT UNIQUE,
        blocked BOOLEAN DEFAULT false,
        total_orders INTEGER DEFAULT 0,
        total_spent NUMERIC(10,2) DEFAULT 0,
        last_order TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        date TIMESTAMP DEFAULT NOW(),
        customer_id INTEGER REFERENCES users(id),
        items JSONB,
        product_total NUMERIC(10,2),
        delivery_charge NUMERIC(10,2),
        rain_fare NUMERIC(10,2) DEFAULT 0,
        commission_amount NUMERIC(10,2),
        admin_profit NUMERIC(10,2),
        grand_total NUMERIC(10,2),
        payment_method TEXT,
        payment_status TEXT,
        status TEXT,
        delivery_address TEXT
      );

      CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        title TEXT,
        discount TEXT,
        code TEXT,
        bg TEXT,
        icon TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id SERIAL PRIMARY KEY,
        order_id TEXT NOT NULL,
        recipient_phone TEXT NOT NULL,
        recipient_type TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      INSERT INTO categories (name, image) VALUES
      ('Food', 'https://placehold.co/100'),
      ('Vegetables', 'https://placehold.co/100'),
      ('Meat', 'https://placehold.co/100'),
      ('Dairy', 'https://placehold.co/100'),
      ('Snacks', 'https://placehold.co/100'),
      ('Cool Drinks', 'https://placehold.co/100')
      ON CONFLICT DO NOTHING;

      INSERT INTO restaurants (name, category, logo, status) VALUES
      ('Pizza Hut', 'Food', 'https://placehold.co/100', 'Active'),
      ('Biryani House', 'Food', 'https://placehold.co/100', 'Active')
      ON CONFLICT DO NOTHING;

      INSERT INTO products (name, category, restaurant_id, price, commission, status, images, variants) VALUES
      ('Pepperoni Pizza', 'Food', 1, 299, 10, 'Active', ARRAY['https://placehold.co/400x400'], '[]'),
      ('Chicken Biryani', 'Food', 2, 249, 10, 'Active', ARRAY['https://placehold.co/400x400'], '[]'),
      ('Organic Apples', 'Vegetables', NULL, 99, 8, 'Active', ARRAY['https://placehold.co/400x400'], '[]'),
      ('Cola', 'Cool Drinks', NULL, 0, 5, 'Active', ARRAY['https://placehold.co/400x400'], '[{"label":"750ml","price":40},{"label":"2L","price":100}]')
      ON CONFLICT DO NOTHING;

      INSERT INTO offers (title, discount, code, bg, icon) VALUES
      ('First Order', '₹100 OFF', 'CAPTA100', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'fa-gift'),
      ('Weekend Sale', '20% OFF', 'WEEKEND20', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 'fa-tags'),
      ('Free Delivery', '₹0 Delivery', 'FREESHIP', 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 'fa-truck')
      ON CONFLICT DO NOTHING;

      INSERT INTO places (area, sub_area, charge, min_order, time, status) VALUES
      ('Downtown', 'Main Street', 30, 100, '20-30 min', 'Active'),
      ('Uptown', 'Park Avenue', 45, 150, '30-40 min', 'Active')
      ON CONFLICT DO NOTHING;

      INSERT INTO users (first_name, last_name, address, pincode, phone) VALUES
      ('John', 'Doe', '123 Main St', '560001', '9876543210')
      ON CONFLICT (phone) DO NOTHING;

      INSERT INTO settings (key, value) VALUES
      ('active_admin_phone', '+919019825189'),
      ('default_commission', '10'),
      ('rain_fare', '20'),
      ('delivery_hours', '9:00 AM - 10:00 PM'),
      ('unavailable_days', '["Monday"]'),
      ('service_unavailable', 'false')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log('✅ Seed completed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();