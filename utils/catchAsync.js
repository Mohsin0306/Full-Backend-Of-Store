/**
 * Wraps an async function to handle errors automatically
 * @param {Function} fn - The async function to wrap
 * @returns {Function} - The wrapped function that handles errors
 */
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next))
            .catch((err) => {
                // Log the error for debugging
                console.error('Error caught by catchAsync:', err);

                // Handle different types of errors
                if (err.name === 'ValidationError') {
                    return res.status(400).json({
                        success: false,
                        message: 'Validation Error',
                        errors: Object.values(err.errors).map(e => e.message)
                    });
                }

                if (err.name === 'CastError') {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid ID format'
                    });
                }

                if (err.code === 11000) {
                    const field = Object.keys(err.keyValue)[0];
                    return res.status(400).json({
                        success: false,
                        message: `${field} already exists`
                    });
                }

                // Default error response
                res.status(500).json({
                    success: false,
                    message: 'Internal Server Error',
                    error: process.env.NODE_ENV === 'development' ? err.message : undefined
                });
            });
    };
};

module.exports = catchAsync; 