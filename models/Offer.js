const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Offer = sequelize.define('Offer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    discount: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    code: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    bg: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    icon: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    restaurant_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'restaurants',
            key: 'id'
        }
    },
    category: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    description: {
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
    tableName: 'offers',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = Offer;