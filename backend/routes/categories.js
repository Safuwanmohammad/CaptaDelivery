// Update your PUT handler for categories
router.put('/categories/:id', async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { name, image } = req.body;
        
        // Validate input
        if (!name || name.trim() === '') {
            return res.status(400).json({ 
                message: 'Category name is required' 
            });
        }
        
        // Validate and compress image if provided
        let processedImage = null;
        if (image) {
            // Check if it's a valid base64 image
            if (!image.startsWith('data:image/')) {
                return res.status(400).json({ 
                    message: 'Invalid image format. Please provide a valid image.' 
                });
            }
            
            // Check image size (limit to 200KB after processing)
            const base64Data = image.split(',')[1] || image;
            const imageSizeInBytes = Buffer.from(base64Data, 'base64').length;
            
            if (imageSizeInBytes > 200 * 1024) { // 200KB limit
                return res.status(400).json({
                    message: 'Image too large. Please use an image under 200KB.'
                });
            }
            
            // Optional: Validate image dimensions or format
            processedImage = image;
        }
        
        // Update the category in database
        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { 
                name: name.trim(),
                ...(processedImage && { image: processedImage })
            },
            { new: true, runValidators: true }
        );
        
        if (!updatedCategory) {
            return res.status(404).json({ 
                message: 'Category not found' 
            });
        }
        
        res.json({
            success: true,
            data: updatedCategory,
            message: 'Category updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating category:', error);
        
        // Handle specific errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                message: error.message 
            });
        }
        
        if (error.name === 'CastError') {
            return res.status(400).json({ 
                message: 'Invalid category ID' 
            });
        }
        
        res.status(500).json({ 
            message: 'Unable to add image to category. Please try again.' 
        });
    }
});