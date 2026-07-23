const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    order_id: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    customer_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    items: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    product_total: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    delivery_charge: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    rain_fare: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    commission_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    admin_profit: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    grand_total: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    payment_method: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    payment_status: {
        type: DataTypes.STRING(50),
        defaultValue: 'Pending'
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'Pending'
    },
    delivery_address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'orders',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = Order;
