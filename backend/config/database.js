const { Sequelize } = require('sequelize');

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.warn('⚠️ DATABASE_URL not set in environment variables');
    console.warn('⚠️ Using in-memory SQLite for testing');
    
    // Fallback to SQLite for testing (optional)
    const { Sequelize: SqliteSequelize } = require('sequelize');
    module.exports = new SqliteSequelize({
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false
    });
} else {
    // Use PostgreSQL
    const sequelize = new Sequelize(databaseUrl, {
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        },
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });
    
    module.exports = sequelize;
}