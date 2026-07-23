const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// ============================================
// Initialize App
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Middleware Setup
// ============================================

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Compression
app.use(compression());

// IMPORTANT: Increase payload limits for image uploads
app.use(express.json({ 
    limit: '1mb',  // Increased from default 100kb to handle base64 images
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
    limit: '1mb' 
}));

// Serve static files
app.use(express.static('public'));

// ============================================
// Database Connection
// ============================================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/captadelivery', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('✅ Connected to MongoDB');
})
.catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
});

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

// Register routes
app.use('/api', categoryRoutes);
app.use('/api', productRoutes);
app.use('/api', restaurantRoutes);
app.use('/api', orderRoutes);
app.use('/api', customerRoutes);
app.use('/api', offerRoutes);
app.use('/api', placeRoutes);
app.use('/api', settingsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// ============================================
// Error Handling Middleware (Must be after routes)
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || '*'}`);
});

// ============================================
// Graceful Shutdown
// ============================================
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    app.close(() => {
        mongoose.connection.close(false, () => {
            console.log('💾 MongoDB connection closed');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    app.close(() => {
        mongoose.connection.close(false, () => {
            console.log('💾 MongoDB connection closed');
            process.exit(0);
        });
    });
});

module.exports = app;