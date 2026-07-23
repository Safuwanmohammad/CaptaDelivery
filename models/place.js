const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Place = sequelize.define('Place', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    area: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    sub_area: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    charge: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    min_order: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    time: {
        type: DataTypes.STRING(50),
        defaultValue: '20-30 min'
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'Active'
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
    tableName: 'places',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = Place;