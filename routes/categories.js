const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { Op } = require('sequelize');

// ============================================
// HELPER FUNCTION: Validate and Process Image
// ============================================
async function validateAndProcessImage(imageData) {
    // Check if it's a valid base64 image string
    if (typeof imageData !== 'string') {
        return {
            success: false,
            message: 'Image must be a string (base64 encoded or URL)'
        };
    }
    
    // If it's a URL, accept it directly
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
        return {
            success: true,
            data: imageData
        };
    }
    
    // If it's base64, validate format
    if (!imageData.startsWith('data:image/')) {
        return {
            success: false,
            message: 'Invalid image format. Please provide a valid image (JPG, PNG, or GIF).'
        };
    }
    
    // Check image size (limit to 200KB after processing)
    try {
        const base64Data = imageData.split(',')[1] || imageData;
        const buffer = Buffer.from(base64Data, 'base64');
        const sizeInBytes = buffer.length;
        
        if (sizeInBytes > 200 * 1024) { // 200KB limit
            return {
                success: false,
                message: 'Image too large. Please use an image under 200KB.'
            };
        }
        
        // Validate that it's actually an image
        const imageType = imageData.match(/data:image\/(\w+);base64,/);
        if (!imageType || !['jpeg', 'png', 'gif', 'webp'].includes(imageType[1])) {
            return {
                success: false,
                message: 'Invalid image type. Supported formats: JPG, PNG, GIF, WebP.'
            };
        }
        
        return {
            success: true,
            data: imageData
        };
        
    } catch (error) {
        console.error('Error processing image:', error);
        return {
            success: false,
            message: 'Failed to process image: ' + error.message
        };
    }
}

// ============================================
// GET all categories
// ============================================
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.findAll({
            order: [['createdAt', 'DESC']],
            raw: true
        });
        
        res.json({
            success: true,
            data: categories,
            count: categories.length
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch categories'
        });
    }
});

// ============================================
// GET single category
// ============================================
router.get('/categories/:id', async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id, { raw: true });
        
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('Error fetching category:', error);
        
        if (error.name === 'SequelizeDatabaseError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid category ID format'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to fetch category'
        });
    }
});

// ============================================
// CREATE new category
// ============================================
router.post('/categories', async (req, res) => {
    try {
        const { name, image } = req.body;
        
        // Validate required fields
        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }
        
        // Validate and process image if provided
        let processedImage = null;
        if (image) {
            const validation = await validateAndProcessImage(image);
            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    message: validation.message
                });
            }
            processedImage = validation.data;
        }
        
        // Create new category
        const newCategory = await Category.create({
            name: name.trim(),
            image: processedImage,
            isActive: true
        });
        
        res.status(201).json({
            success: true,
            data: newCategory,
            message: 'Category created successfully'
        });
        
    } catch (error) {
        console.error('Error creating category:', error);
        
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: error.errors.map(e => e.message).join(', ')
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to create category'
        });
    }
});

// ============================================
// UPDATE category (FIXED VERSION)
// ============================================
router.put('/categories/:id', async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { name, image } = req.body;
        
        // Validate name
        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }
        
        // Find category
        const category = await Category.findByPk(categoryId);
        
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        // Prepare update data
        const updateData = {
            name: name.trim(),
            updatedAt: new Date()
        };
        
        // Process image if provided
        if (image !== undefined) {
            if (image === null || image === '') {
                // Remove image if explicitly set to null or empty string
                updateData.image = null;
            } else {
                // Validate and process new image
                const validation = await validateAndProcessImage(image);
                if (!validation.success) {
                    return res.status(400).json({
                        success: false,
                        message: validation.message
                    });
                }
                updateData.image = validation.data;
            }
        }
        
        // Update category
        await category.update(updateData);
        
        // Fetch updated category
        const updatedCategory = await Category.findByPk(categoryId, { raw: true });
        
        res.json({
            success: true,
            data: updatedCategory,
            message: 'Category updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating category:', error);
        
        // Handle specific error types
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: error.errors.map(e => e.message).join(', ')
            });
        }
        
        if (error.name === 'SequelizeDatabaseError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid category ID format'
            });
        }
        
        // For image-specific errors
        if (error.message && (error.message.includes('image') || error.message.includes('Image'))) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        
        // Default error response
        res.status(500).json({
            success: false,
            message: 'Unable to add image to category. Please try again.'
        });
    }
});

// ============================================
// DELETE category
// ============================================
router.delete('/categories/:id', async (req, res) => {
    try {
        const categoryId = req.params.id;
        
        // Find category
        const category = await Category.findByPk(categoryId);
        
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        // Delete category
        await category.destroy();
        
        res.json({
            success: true,
            message: 'Category deleted successfully',
            data: { id: categoryId }
        });
        
    } catch (error) {
        console.error('Error deleting category:', error);
        
        if (error.name === 'SequelizeDatabaseError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid category ID format'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to delete category'
        });
    }
});

module.exports = router;