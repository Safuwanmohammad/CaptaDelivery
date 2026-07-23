const sequelize = require('./config/database');
const Category = require('./models/Category');
const Restaurant = require('./models/Restaurant');
const Product = require('./models/Product');
const Order = require('./models/Order');
const User = require('./models/User');
const Offer = require('./models/Offer');
const Place = require('./models/Place');
const Setting = require('./models/Setting');

async function migrate() {
    try {
        console.log('🔄 Starting database migration...');
        
        // Authenticate
        await sequelize.authenticate();
        console.log('✅ Connected to database');
        
        // Sync all models with alter: true
        // This will add missing columns without dropping data
        await sequelize.sync({ alter: true });
        console.log('✅ All tables synchronized successfully!');
        
        // Log all tables
        const models = Object.keys(sequelize.models);
        console.log(`📊 Tables created/updated: ${models.join(', ')}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrate();
