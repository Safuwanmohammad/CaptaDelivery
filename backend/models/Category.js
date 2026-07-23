const mongoose = require('mongoose');

// ============================================
// Category Schema with Image Validation
// ============================================
const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
        minlength: [2, 'Category name must be at least 2 characters long'],
        maxlength: [100, 'Category name cannot exceed 100 characters'],
        validate: {
            validator: function(v) {
                return v.trim().length > 0;
            },
            message: 'Category name cannot be empty'
        }
    },
    image: {
        type: String,
        required: false,
        validate: {
            validator: function(v) {
                // Allow null or empty
                if (!v) return true;
                
                // Allow URLs
                if (v.startsWith('http://') || v.startsWith('https://')) {
                    return true;
                }
                
                // Validate base64 image
                if (v.startsWith('data:image/')) {
                    // Check size by converting base64 to buffer
                    try {
                        const base64Data = v.split(',')[1] || v;
                        const buffer = Buffer.from(base64Data, 'base64');
                        // Limit to 200KB
                        return buffer.length <= 200 * 1024;
                    } catch (error) {
                        return false;
                    }
                }
                
                return false;
            },
            message: 'Invalid image format or image too large (max 200KB)'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true, // Automatically manage createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Pre-save middleware to update timestamps
categorySchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Pre-update middleware for findByIdAndUpdate
categorySchema.pre('findOneAndUpdate', function(next) {
    this.set({ updatedAt: new Date() });
    next();
});

// Index for performance
categorySchema.index({ name: 1 });
categorySchema.index({ isActive: 1 });

// Virtual field to check if category has image
categorySchema.virtual('hasImage').get(function() {
    return !!this.image;
});

// Static method to find active categories
categorySchema.statics.findActive = function() {
    return this.find({ isActive: true });
};

// Instance method to get image URL
categorySchema.methods.getImageUrl = function() {
    if (this.image) {
        if (this.image.startsWith('http')) {
            return this.image;
        }
        return this.image;
    }
    return null;
};

module.exports = mongoose.model('Category', categorySchema);