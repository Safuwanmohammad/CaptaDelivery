const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const sequelize = require('./config/database');

// ============================================
// ⭐ IMPORT ALL MODELS - SEQUELIZE ONLY
// ============================================
// These models must use Sequelize, NOT Mongoose
const Category = require('./models/Category');
const Product = require('./models/Product');
const Restaurant = require('./models/Restaurant');
const Order = require('./models/Order');
const User = require('./models/user');
const Offer = require('./models/Offer');
const Place = require('./models/Place');
const Setting = require('./models/Setting');

// ============================================
// Initialize App
// ============================================
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// Middleware
// ============================================
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

app.use(express.json({ 
    limit: '2mb',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            res.status(400).json({
                success: false,
                message: 'Invalid JSON payload'
            });
            throw new Error('Invalid JSON');
        }
    }
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '2mb',
    parameterLimit: 50000
}));

// ============================================
// Static Files
// ============================================
const frontendPath = path.join(__dirname, '../frontend');
const publicPath = path.join(__dirname, '../public');
const staticPath = fs.existsSync(frontendPath) ? frontendPath : publicPath;

console.log(`📁 Serving static files from: ${staticPath}`);

app.use(express.static(staticPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
        res.setHeader('Content-Security-Policy', 
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
            "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
            "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; " +
            "img-src 'self' data: https: http:; " +
            "connect-src 'self' https://*.render.com;"
        );
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    }
}));

// ============================================
// Request Logging
// ============================================
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    
    if (url.startsWith('/api') || url === '/' || url === '/admin.html') {
        console.log(`📡 ${timestamp} ${method} ${url}`);
    }
    
    next();
});

// ============================================
// Routes - ALL MONGODB ROUTES REMOVED
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
// Frontend Routes
// ============================================
app.get('/', (req, res) => {
    const indexPath = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>CapTA Delivery</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #e74c3c; }
                    .status { color: #27ae60; font-weight: bold; }
                    .endpoint { background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; font-family: monospace; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🚀 CapTA Delivery API</h1>
                    <p class="status">✅ API is running</p>
                    <div class="endpoint">GET /health - Health Check</div>
                    <div class="endpoint">GET /api/categories - Categories</div>
                    <div class="endpoint">GET /api/products - Products</div>
                    <p><a href="/admin.html">📊 Admin Panel</a></p>
                    <p><small>Version 1.0.1</small></p>
                </div>
            </body>
            </html>
        `);
    }
});

app.get('/admin.html', (req, res) => {
    const adminPath = path.join(staticPath, 'admin.html');
    if (fs.existsSync(adminPath)) {
        res.sendFile(adminPath);
    } else {
        res.status(404).json({
            success: false,
            message: 'Admin panel not found'
        });
    }
});

// ============================================
// Health Check
// ============================================
app.get('/health', async (req, res) => {
    try {
        await sequelize.authenticate();
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            database: 'connected',
            version: '1.0.1',
            environment: process.env.NODE_ENV || 'development',
            models: Object.keys(sequelize.models)
        });
    } catch (error) {
        res.status(503).json({
            status: 'DEGRADED',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

// ============================================
// Error Handling
// ============================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ============================================
// ⭐ START SERVER WITH AUTO-SYNC
// ============================================
async function startServer() {
    try {
        // Test database connection
        await sequelize.authenticate();
        console.log('✅ Connected to PostgreSQL (NeonDB) at', new Date().toISOString());
        
        // ⭐ IMPORTANT: Sync all models - adds missing columns automatically
        // alter: true adds columns without dropping data
        // force: true would drop and recreate (use with caution)
        await sequelize.sync({ 
            alter: process.env.NODE_ENV !== 'production',
            logging: process.env.NODE_ENV === 'development' ? console.log : false
        });
        console.log('✅ Database synchronized - all tables/columns updated');
        
        // Log available models
        const models = Object.keys(sequelize.models);
        console.log(`📊 Models: ${models.join(', ')}`);
        
        // Start server
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📁 Static files: ${staticPath}`);
            console.log(`🔗 http://localhost:${PORT}`);
            console.log(`📊 Admin: http://localhost:${PORT}/admin.html`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`💾 Database: PostgreSQL via NeonDB`);
        });
        
        server.timeout = 60000;
        server.keepAliveTimeout = 65000;
        
        return server;
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        console.error('Error details:', error.message);
        if (error.original) {
            console.error('Original error:', error.original.message);
        }
        process.exit(1);
    }
}

// ============================================
// Graceful Shutdown
// ============================================
let serverInstance = null;

async function gracefulShutdown(signal) {
    console.log(`🛑 ${signal} received, shutting down gracefully...`);
    
    if (serverInstance) {
        await new Promise((resolve) => {
            serverInstance.close(() => {
                console.log('🔌 Server closed');
                resolve();
            });
        });
    }
    
    try {
        await sequelize.close();
        console.log('💾 Database connection closed');
    } catch (error) {
        console.error('Error closing database:', error);
    }
    
    console.log('👋 Goodbye!');
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
    gracefulShutdown('unhandledRejection');
});

// ============================================
// Start Server
// ============================================
if (require.main === module) {
    startServer().then(server => {
        serverInstance = server;
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { app, startServer };