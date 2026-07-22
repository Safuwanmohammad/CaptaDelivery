const pool = require('./db');

const seed = async () => {
  try {
    console.log('🌱 Seeding database...');

    const test = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', test.rows[0].now);

    await pool.query(`
      DROP TABLE IF EXISTS whatsapp_logs CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS restaurants CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
      DROP TABLE IF EXISTS offers CASCADE;
      DROP TABLE IF EXISTS places CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS settings CASCADE;
    `);

    console.log('✅ Tables dropped');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        image TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS restaurants (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        logo TEXT,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price NUMERIC(10,2) DEFAULT 0,
        category TEXT,
        restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE SET NULL,
        commission NUMERIC(5,2) DEFAULT 0,
        status TEXT DEFAULT 'Active',
        images JSONB DEFAULT '[]'::jsonb,
        variants JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS places (
        id SERIAL PRIMARY KEY,
        area TEXT NOT NULL,
        sub_area TEXT NOT NULL,
        charge NUMERIC(10,2),
        min_order NUMERIC(10,2),
        time TEXT,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW()
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
        delivery_address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        title TEXT,
        discount TEXT,
        code TEXT UNIQUE,
        bg TEXT,
        icon TEXT,
        restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE SET NULL,
        category TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
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

    console.log('✅ Tables created');

    await pool.query(`
      INSERT INTO categories (name, image) VALUES
      ('Food', 'https://placehold.co/100x100/007BFF/white?text=Food'),
      ('Vegetables', 'https://placehold.co/100x100/22c55e/white?text=Veg'),
      ('Meat', 'https://placehold.co/100x100/ef4444/white?text=Meat'),
      ('Dairy', 'https://placehold.co/100x100/f59e0b/white?text=Dairy'),
      ('Snacks', 'https://placehold.co/100x100/8b5cf6/white?text=Snacks'),
      ('Cool Drinks', 'https://placehold.co/100x100/06b6d4/white?text=Drinks')
      ON CONFLICT (name) DO NOTHING;

      INSERT INTO restaurants (name, category, logo, status) VALUES
      ('Pizza Hut', 'Food', 'https://placehold.co/100x100/FF6B6B/white?text=PH', 'Active'),
      ('Biryani House', 'Food', 'https://placehold.co/100x100/FFA94D/white?text=BH', 'Active'),
      ('Subway', 'Food', 'https://placehold.co/100x70/008000/white?text=Subway', 'Active')
      ON CONFLICT DO NOTHING;

      INSERT INTO products (name, category, restaurant_id, price, commission, status, images, variants) VALUES
      ('Pepperoni Pizza', 'Food', 1, 299, 10, 'Active', '["https://placehold.co/400x400/FF6B6B/white?text=Pizza"]'::jsonb, 
       '[{"label":"Small","price":199,"description":"6 inches"},{"label":"Medium","price":299,"description":"10 inches"},{"label":"Large","price":399,"description":"12 inches"}]'::jsonb),
      ('Chicken Biryani', 'Food', 2, 249, 10, 'Active', '["https://placehold.co/400x400/FFA94D/white?text=Biryani"]'::jsonb, 
       '[{"label":"Regular","price":249,"description":"Single serving"},{"label":"Family Pack","price":499,"description":"Serves 4"}]'::jsonb),
      ('Organic Apples', 'Vegetables', NULL, 99, 8, 'Active', '["https://placehold.co/400x400/22c55e/white?text=Apples"]'::jsonb, '[]'::jsonb),
      ('Cola', 'Cool Drinks', NULL, 40, 5, 'Active', '["https://placehold.co/400x400/06b6d4/white?text=Cola"]'::jsonb, 
       '[{"label":"750ml","price":40,"description":"Bottle"},{"label":"2L","price":100,"description":"Family size"}]'::jsonb),
      ('Veggie Delight', 'Food', 3, 199, 10, 'Active', '["https://placehold.co/400x400/008000/white?text=Veggie"]'::jsonb, 
       '[{"label":"Regular","price":199,"description":"Standard"},{"label":"Large","price":299,"description":"Extra large"}]'::jsonb)
      ON CONFLICT DO NOTHING;

      INSERT INTO offers (title, discount, bg, icon, restaurant_id, category, description) VALUES
      ('Pizza Hut Special', '20% OFF on all Pizzas', 'linear-gradient(135deg, #FF6B6B 0%, #ee5a24 100%)', 'fa-pizza-slice', 1, NULL, 'Get 20% off on all pizzas at Pizza Hut'),
      ('Biryani House Deal', '15% OFF on Biryani', 'linear-gradient(135deg, #FFA94D 0%, #f093fb 100%)', 'fa-utensils', 2, NULL, 'Enjoy 15% off on all biryani items'),
      ('Fresh Vegetables', '10% OFF on Vegetables', 'linear-gradient(135deg, #22c55e 0%, #059669 100%)', 'fa-carrot', NULL, 'Vegetables', 'Get 10% off on all fresh vegetables')
      ON CONFLICT DO NOTHING;

      INSERT INTO places (area, sub_area, charge, min_order, time, status) VALUES
      ('Downtown', 'Main Street', 30, 100, '20-30 min', 'Active'),
      ('Uptown', 'Park Avenue', 45, 150, '30-40 min', 'Active'),
      ('Westside', 'Lake View', 35, 120, '25-35 min', 'Active')
      ON CONFLICT DO NOTHING;

      INSERT INTO users (first_name, last_name, address, pincode, phone) VALUES
      ('John', 'Doe', '123 Main St', '560001', '+919876543210'),
      ('Jane', 'Smith', '456 Park Ave', '560002', '+919876543211')
      ON CONFLICT (phone) DO NOTHING;

      INSERT INTO settings (key, value) VALUES
      ('active_admin_phone', '+919019825189'),
      ('admin_phones', '["+919019825189","+91827079552","+919483685462"]'),
      ('default_commission', '10'),
      ('rain_fare', '20'),
      ('rain_fare_enabled', 'true'),
      ('delivery_hours', '9:00 AM - 10:00 PM'),
      ('unavailable_days', '["Monday"]'),
      ('service_unavailable', 'false')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log('✅ Seed completed successfully with variants');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
};

seed();