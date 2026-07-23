const { DataTypes } = require('sequelize');
const sequelize = require('../db.js'); // Ensure this path points to your Sequelize instance

const Category = sequelize.define('Category', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Category name is required'
            },
            len: {
                args: [2, 100],
                msg: 'Category name must be between 2 and 100 characters'
            }
        }
    },
    image: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
            isValidImage(value) {
                if (!value) return true;
                if (value.startsWith('http://') || value.startsWith('https://')) {
                    return true;
                }
                if (value.startsWith('data:image/')) {
                    try {
                        const base64Data = value.split(',')[1] || value;
                        const buffer = Buffer.from(base64Data, 'base64');
                        if (buffer.length > 200 * 1024) {
                            throw new Error('Image too large (max 200KB)');
                        }
                        return true;
                    } catch (error) {
                        throw new Error('Invalid image format');
                    }
                }
                throw new Error('Invalid image format. Use URL or base64 image.');
            }
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
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
    tableName: 'categories',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = Category;