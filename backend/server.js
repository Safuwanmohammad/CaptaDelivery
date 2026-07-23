const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const sequelize = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// ============================================
// Initialize App
// ============================================
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// Middleware Setup
// ============================================

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'", "https://*.render.com"]
        }
    }
}));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Compression for better performance
app.use(compression({
    level: 6,
    threshold: 1024, // Only compress responses above 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// IMPORTANT: Increase payload limits for image uploads
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
// Static Files Serving
// ============================================
// Serve static files from frontend directory
const frontendPath = path.join(__dirname, '../frontend');
const publicPath = path.join(__dirname, '../public');

// Check if frontend directory exists, otherwise use public
const staticPath = require('fs').existsSync(frontendPath) ? frontendPath : publicPath;

console.log(`📁 Serving static files from: ${staticPath}`);
app.use(express.static(staticPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true
}));

// ============================================
// Request Logging (for debugging)
// ============================================
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const ip = req.ip || req.connection.remoteAddress;
    
    // Log only API requests or important routes
    if (url.startsWith('/api') || url === '/' || url === '/admin.html') {
        console.log(`📡 ${timestamp} ${method} ${url} from ${ip}`);
    }
    
    // Capture response body for PUT/POST requests
    if ((method === 'PUT' || method === 'POST') && url.startsWith('/api')) {
        const oldSend = res.send;
        res.send = function(data) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.success === false) {
                    console.log(`❌ Error response:`, parsed.message);
                }
            } catch (e) {
                // Not JSON, ignore
            }
            oldSend.call(this, data);
        };
    }
    
    next();
});

// ============================================
// Routes
// ============================================
// Import route modules
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const restaurantRoutes = require('./routes/restaurants');
const orderRoutes = require('./routes/orders');
const customerRoutes = require('./routes/customers');
const offerRoutes = require('./routes/offers');
const placeRoutes = require('./routes/places');
const settingsRoutes = require('./routes/settings');

// Register API routes
app.use('/api', categoryRoutes);
app.use('/api', productRoutes);
app.use('/api', restaurantRoutes);
app.use('/api', orderRoutes);
app.use('/api', customerRoutes);
app.use('/api', offerRoutes);
app.use('/api', placeRoutes);
app.use('/api', settingsRoutes);

// ============================================
// Frontend Routes
// ============================================
// Serve index.html for root
app.get('/', (req, res) => {
    const indexPath = path.join(staticPath, 'index.html');
    if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>CapTA Delivery</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .container { max-width: 600px; margin: 0 auto; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🚀 CapTA Delivery API</h1>
                    <p>API is running. Access <a href="/admin.html">Admin Panel</a></p>
                    <p><small>Version 1.0.1</small></p>
                </div>
            </body>
            </html>
        `);
    }
});

// Serve admin.html
app.get('/admin.html', (req, res) => {
    const adminPath = path.join(staticPath, 'admin.html');
    if (require('fs').existsSync(adminPath)) {
        res.sendFile(adminPath);
    } else {
        res.status(404).json({
            success: false,
            message: 'Admin panel not found'
        });
    }
});

// Serve script.js
app.get('/script.js', (req, res) => {
    const scriptPath = path.join(staticPath, 'script.js');
    if (require('fs').existsSync(scriptPath)) {
        res.sendFile(scriptPath);
    } else {
        res.status(404).json({
            success: false,
            message: 'Script file not found'
        });
    }
});

// Serve style.css
app.get('/style.css', (req, res) => {
    const stylePath = path.join(staticPath, 'style.css');
    if (require('fs').existsSync(stylePath)) {
        res.sendFile(stylePath);
    } else {
        res.status(404).json({
            success: false,
            message: 'Style file not found'
        });
    }
});

// ============================================
// Health Check Endpoints
// ============================================
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        await sequelize.authenticate();
        const dbStatus = 'connected';
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            database: dbStatus,
            version: '1.0.1',
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(503).json({
            status: 'DEGRADED',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: 'disconnected',
            error: error.message
        });
    }
});

// Simple ping endpoint for monitoring
app.head('/', (req, res) => {
    res.status(200).end();
});

// ============================================
// Error Handling Middleware (Must be after routes)
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// Database Sync and Start Server
// ============================================
async function startServer() {
    try {
        // Test database connection
        await sequelize.authenticate();
        console.log('✅ Connected to PostgreSQL at', new Date().toISOString());
        
        // Sync models (create tables if they don't exist)
        // Use alter: true to update existing tables without dropping data
        await sequelize.sync({ 
            alter: process.env.NODE_ENV !== 'production',
            logging: process.env.NODE_ENV === 'development' ? console.log : false
        });
        console.log('✅ Database synchronized');
        
        // Log available models
        const models = Object.keys(sequelize.models);
        console.log(`📊 Available models: ${models.join(', ')}`);
        
        // Start server
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`📁 Serving static files from: ${staticPath}`);
            console.log(`🔗 Visit: http://localhost:${PORT}`);
            console.log(`📊 Admin panel: http://localhost:${PORT}/admin.html`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`💾 Database: PostgreSQL via NeonDB`);
        });
        
        // Server timeout settings
        server.timeout = 60000; // 60 seconds
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
    
    // Close server
    if (serverInstance) {
        await new Promise((resolve) => {
            serverInstance.close(() => {
                console.log('🔌 Server closed');
                resolve();
            });
        });
    }
    
    // Close database connection
    try {
        await sequelize.close();
        console.log('💾 Database connection closed');
    } catch (error) {
        console.error('Error closing database:', error);
    }
    
    console.log('👋 Goodbye!');
    process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
    gracefulShutdown('unhandledRejection');
});

// ============================================
// Export for testing
// ============================================
module.exports = { app, startServer };

// ============================================
// Start Server (if not in test environment)
// ============================================
if (require.main === module) {
    startServer().then(server => {
        serverInstance = server;
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}