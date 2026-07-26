const pool = require('./db');

async function migrate() {
    try {
        console.log('🔄 Starting database migration...');
        
        // Test connection
        await pool.query('SELECT NOW()');
        console.log('✅ Connected to database');

        // ============================================================
        // 1. ADD ORDER_NUMBER COLUMN
        // ============================================================
        await pool.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE orders ADD COLUMN order_number VARCHAR(20);
                EXCEPTION
                    WHEN duplicate_column THEN 
                        RAISE NOTICE 'Column order_number already exists, skipping...';
                END;
            END $$;
        `);
        console.log('✅ order_number column check complete');

        // ============================================================
        // 2. ADD ORDER_DATE COLUMN
        // ============================================================
        await pool.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE orders ADD COLUMN order_date VARCHAR(20);
                EXCEPTION
                    WHEN duplicate_column THEN 
                        RAISE NOTICE 'Column order_date already exists, skipping...';
                END;
            END $$;
        `);
        console.log('✅ order_date column check complete');

        // ============================================================
        // 3. ADD ORDER_TIME COLUMN
        // ============================================================
        await pool.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE orders ADD COLUMN order_time VARCHAR(20);
                EXCEPTION
                    WHEN duplicate_column THEN 
                        RAISE NOTICE 'Column order_time already exists, skipping...';
                END;
            END $$;
        `);
        console.log('✅ order_time column check complete');

        // ============================================================
        // 4. ADD TIMEZONE COLUMN
        // ============================================================
        await pool.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE orders ADD COLUMN timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';
                EXCEPTION
                    WHEN duplicate_column THEN 
                        RAISE NOTICE 'Column timezone already exists, skipping...';
                END;
            END $$;
        `);
        console.log('✅ timezone column check complete');

        // ============================================================
        // 5. ADD DISCOUNT COLUMN
        // ============================================================
        await pool.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE orders ADD COLUMN discount NUMERIC(10,2) DEFAULT 0;
                EXCEPTION
                    WHEN duplicate_column THEN 
                        RAISE NOTICE 'Column discount already exists, skipping...';
                END;
            END $$;
        `);
        console.log('✅ discount column check complete');

        // ============================================================
        // 6. ADD RAIN_FARE COLUMN (if not exists)
        // ============================================================
        await pool.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE orders ADD COLUMN rain_fare NUMERIC(10,2) DEFAULT 0;
                EXCEPTION
                    WHEN duplicate_column THEN 
                        RAISE NOTICE 'Column rain_fare already exists, skipping...';
                END;
            END $$;
        `);
        console.log('✅ rain_fare column check complete');

        // ============================================================
        // 7. ADD UNIQUE CONSTRAINT ON ORDER_NUMBER
        // ============================================================
        await pool.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE orders ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);
                EXCEPTION
                    WHEN duplicate_table THEN 
                        RAISE NOTICE 'Constraint already exists, skipping...';
                END;
            END $$;
        `);
        console.log('✅ unique constraint check complete');

        // ============================================================
        // 8. CREATE INDEXES
        // ============================================================
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_order_time ON orders(order_time);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);`);
        console.log('✅ Indexes created');

        // ============================================================
        // 9. CREATE WHATSAPP_LOGS TABLE
        // ============================================================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_logs (
                id SERIAL PRIMARY KEY,
                order_id VARCHAR(20) NOT NULL,
                recipient_phone VARCHAR(20) NOT NULL,
                recipient_type VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL,
                error_message TEXT,
                sent_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ whatsapp_logs table created');

        // ============================================================
        // 10. CREATE INDEXES FOR WHATSAPP_LOGS
        // ============================================================
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_order_id ON whatsapp_logs(order_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sent_at ON whatsapp_logs(sent_at);`);
        console.log('✅ whatsapp_logs indexes created');

        // ============================================================
        // 11. UPDATE EXISTING ORDERS (using 'date' column instead of 'created_at')
        // ============================================================
        // Set order_number = order_id for existing orders
        await pool.query(`
            UPDATE orders SET order_number = order_id 
            WHERE order_number IS NULL AND order_id IS NOT NULL;
        `);
        console.log('✅ Existing orders updated with order_number');

        // Set order_date and order_time from the 'date' column
        await pool.query(`
            UPDATE orders SET 
                order_date = TO_CHAR(date, 'DD-MM-YYYY'),
                order_time = TO_CHAR(date, 'HH12:MI AM')
            WHERE order_date IS NULL AND date IS NOT NULL;
        `);
        console.log('✅ order_date and order_time set for existing orders');

        // Set timezone for existing orders
        await pool.query(`
            UPDATE orders SET timezone = 'Asia/Kolkata' WHERE timezone IS NULL;
        `);
        console.log('✅ timezone set for existing orders');

        // Set rain_fare = 0 for existing orders where null
        await pool.query(`
            UPDATE orders SET rain_fare = 0 WHERE rain_fare IS NULL;
        `);
        console.log('✅ rain_fare set for existing orders');

        // Set discount = 0 for existing orders where null
        await pool.query(`
            UPDATE orders SET discount = 0 WHERE discount IS NULL;
        `);
        console.log('✅ discount set for existing orders');

        // ============================================================
        // 12. ADD SETTINGS
        // ============================================================
        await pool.query(`
            INSERT INTO settings (key, value) 
            VALUES ('rain_fare_enabled', 'true')
            ON CONFLICT (key) DO NOTHING;
        `);
        console.log('✅ rain_fare_enabled setting added');

        await pool.query(`
            INSERT INTO settings (key, value) 
            VALUES ('admin_whatsapp_number', '+919019825189')
            ON CONFLICT (key) DO NOTHING;
        `);
        console.log('✅ admin_whatsapp_number setting added');

        await pool.query(`
            INSERT INTO settings (key, value) 
            VALUES ('whatsapp_enabled', 'true')
            ON CONFLICT (key) DO NOTHING;
        `);
        console.log('✅ whatsapp_enabled setting added');

        // ============================================================
        // 13. SET TIMEZONE FOR DATABASE SESSION
        // ============================================================
        await pool.query("SET TIME ZONE 'Asia/Kolkata'");
        console.log('✅ Timezone set to Asia/Kolkata');

        console.log('✅ Database migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

migrate();