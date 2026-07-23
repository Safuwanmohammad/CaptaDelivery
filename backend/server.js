const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const sequelize = require('./config/database');

// ⭐ Import ALL models so Sequelize knows about them
const Category = require('./models/Category');
const Product = require('./models/Product');
const Restaurant = require('./models/Restaurant');
const Order = require('./models/Order');
const User = require('./models/user');
const Offer = require('./models/Offer');
const Place = require('./models/Place');
const Setting = require('./models/Setting');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// Middleware
// ============================================
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ============================================
// Static Files
// ============================================
const staticPath = path.join(__dirname, '../frontend');
app.use(express.static(staticPath, {
    setHeaders: (res) => {
        res.setHeader('Content-Security-Policy', 
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
            "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
            "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; " +
            "img-src 'self' data: https: http:; " +
            "connect-src 'self' https://*.render.com;"
        );
    }
}));

// ============================================
// Routes
// ============================================
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const restaurantRoutes = require('./routes/restaurants');
const orderRoutes = require('./routes/orders');
const customerRoutes = require('./routes/customers');
const offerRoutes = require('./routes/offers');
const placeRoutes = require('./routes/places');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');

app.use('/api', categoryRoutes);
app.use('/api', productRoutes);
app.use('/api', restaurantRoutes);
app.use('/api', orderRoutes);
app.use('/api', customerRoutes);
app.use('/api', offerRoutes);
app.use('/api', placeRoutes);
app.use('/api', settingsRoutes);
app.use('/api/auth', authRoutes);

// ============================================
// Frontend
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(staticPath, 'admin.html'));
});

// ============================================
// Health Check
// ============================================
app.get('/health', async (req, res) => {
    try {
        await sequelize.authenticate();
        res.json({ status: 'OK', database: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'DEGRADED', database: 'disconnected' });
    }
});

// ============================================
// Error Handling
// ============================================
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
});

// ============================================
// ⭐ START SERVER WITH AUTO-SYNC
// ============================================
async function startServer() {
    try {
        // Test connection
        await sequelize.authenticate();
        console.log('✅ Connected to NeonDB');
        
        // ⭐ IMPORTANT: This adds all missing columns automatically
        // No SQL needed - Sequelize does it for you!
        await sequelize.sync({ alter: true });
        console.log('✅ Database synced - all tables/columns updated');
        
        // Log what tables exist
        const models = Object.keys(sequelize.models);
        console.log(`📊 Tables: ${models.join(', ')}`);
        
        // Start server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🔗 http://localhost:${PORT}`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start:', error.message);
        process.exit(1);
    }
}

startServer();

module.exports = app;
