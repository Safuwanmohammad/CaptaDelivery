const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

// Helper function to validate images
async function validateAndProcessImage(imageData) {
    if (!imageData || typeof imageData !== 'string') {
        return { success: false, message: 'Image data is required.' };
    }
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
        return { success: true, data: imageData };
    }
    if (!imageData.startsWith('data:image/')) {
        return { success: false, message: 'Invalid format. Must be URL or base64.' };
    }
    try {
        const base64Data = imageData.split(',')[1] || imageData;
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length > 200 * 1024) {
            return { success: false, message: 'Image too large (max 200KB).' };
        }
        return { success: true, data: imageData };
    } catch (error) {
        return { success: false, message: 'Failed to process image.' };
    }
}

// GET all categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.findAll({ order: [['createdAt', 'DESC']] });
        res.json({ success: true, data: categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
    }
});

// GET a single category
router.get('/categories/:id', async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found.' });
        }
        res.json({ success: true, data: category });
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch category.' });
    }
});

// CREATE a new category
router.post('/categories', async (req, res) => {
    try {
        const { name, image } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Category name is required.' });
        }
        let processedImage = null;
        if (image) {
            const validation = await validateAndProcessImage(image);
            if (!validation.success) {
                return res.status(400).json({ success: false, message: validation.message });
            }
            processedImage = validation.data;
        }
        const newCategory = await Category.create({ name: name.trim(), image: processedImage });
        res.status(201).json({ success: true, data: newCategory, message: 'Category created.' });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ success: false, message: 'Failed to create category.' });
    }
});

// UPDATE a category (FIXED)
router.put('/categories/:id', async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found.' });
        }
        const { name, image } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Category name is required.' });
        }
        const updateData = { name: name.trim() };
        if (image !== undefined) {
            if (image === null || image === '') {
                updateData.image = null;
            } else {
                const validation = await validateAndProcessImage(image);
                if (!validation.success) {
                    return res.status(400).json({ success: false, message: validation.message });
                }
                updateData.image = validation.data;
            }
        }
        await category.update(updateData);
        const updatedCategory = await Category.findByPk(req.params.id);
        res.json({ success: true, data: updatedCategory, message: 'Category updated successfully.' });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ success: false, message: 'Unable to update category. Please try again.' });
    }
});

// DELETE a category
router.delete('/categories/:id', async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found.' });
        }
        await category.destroy();
        res.json({ success: true, message: 'Category deleted successfully.' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ success: false, message: 'Failed to delete category.' });
    }
});

module.exports = router;