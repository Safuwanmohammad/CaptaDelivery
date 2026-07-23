const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    category: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    restaurant_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    commission: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'Active'
    },
    images: {
        type: DataTypes.JSONB,
        defaultValue: [],
        get() {
            const value = this.getDataValue('images');
            if (!value) return [];
            if (typeof value === 'string') {
                try { return JSON.parse(value); } catch (e) { return []; }
            }
            return value;
        },
        set(value) {
            if (typeof value === 'string') {
                try { this.setDataValue('images', JSON.parse(value)); } catch (e) { this.setDataValue('images', []); }
            } else {
                this.setDataValue('images', value || []);
            }
        }
    },
    variants: {
        type: DataTypes.JSONB,
        defaultValue: [],
        get() {
            const value = this.getDataValue('variants');
            if (!value) return [];
            if (typeof value === 'string') {
                try { return JSON.parse(value); } catch (e) { return []; }
            }
            return value;
        },
        set(value) {
            if (typeof value === 'string') {
                try { this.setDataValue('variants', JSON.parse(value)); } catch (e) { this.setDataValue('variants', []); }
            } else {
                this.setDataValue('variants', value || []);
            }
        }
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
    tableName: 'products',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = Product;
