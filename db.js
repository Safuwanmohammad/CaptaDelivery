const { Sequelize } = require('sequelize');

// Use the DATABASE_URL from your environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('❌ FATAL: DATABASE_URL is not set in environment variables.');
    console.error('Please set DATABASE_URL in your Render environment variables.');
    process.exit(1);
}

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