// ============================================
// Global Error Handler Middleware
// ============================================

function errorHandler(err, req, res, next) {
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        status: err.status || 500,
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params
    });
    
    // Handle specific error types
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: 'Request entity too large. Please reduce the image size (max 200KB).',
            error: 'PAYLOAD_TOO_LARGE'
        });
    }
    
    // Handle multer errors (if using file upload)
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            message: 'File too large. Maximum file size is 2MB.',
            error: 'FILE_TOO_LARGE'
        });
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: errors,
            error: 'VALIDATION_ERROR'
        });
    }
    
    // Handle MongoDB duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(409).json({
            success: false,
            message: `${field} already exists`,
            error: 'DUPLICATE_KEY'
        });
    }
    
    // Handle CastError (invalid ID)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format',
            error: 'INVALID_ID'
        });
    }
    
    // Handle JSON parsing errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON payload',
            error: 'INVALID_JSON'
        });
    }
    
    // Default error response
    const statusCode = err.status || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: err.code || 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

// ============================================
// 404 Not Found Handler
// ============================================
function notFoundHandler(req, res, next) {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
        error: 'NOT_FOUND'
    });
}

// ============================================
// Async Error Wrapper
// ============================================
function asyncHandler(fn) {
    return function(req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler
};