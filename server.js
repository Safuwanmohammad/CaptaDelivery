const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const pool = require('./db');

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
    threshold: 1024
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
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🚀 CapTA Delivery API</h1>
                    <p class="status">✅ API is running</p>
                    <p><a href="/admin.html">📊 Admin Panel</a></p>
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
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
    });
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
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// ============================================
// Start Server
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Static files: ${staticPath}`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`📊 Admin: http://localhost:${PORT}/admin.html`);
});

module.exports = app;