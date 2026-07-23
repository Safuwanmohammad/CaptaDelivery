const sequelize = require('./config/database');

// Import all models so they register with Sequelize
require('./models/Category');
require('./models/Product');
require('./models/Restaurant');
require('./models/Order');
require('./models/User');
require('./models/Offer');
require('./models/Place');
require('./models/Setting');

async function syncDB() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database');
        
        // ⭐ This does everything - NO SQL needed!
        await sequelize.sync({ alter: true });
        console.log('✅ All tables created/updated successfully!');
        
        console.log('\n📊 Tables created:');
        Object.keys(sequelize.models).forEach(model => {
            console.log(`  - ${model}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

syncDB();