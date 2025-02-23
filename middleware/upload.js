const multer = require('multer');
const path = require('path');

// Configure multer for temporary storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'tmp/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter with expanded file types and file extension check
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/jpg',
    'image/jfif',
    'image/pjpeg',
    'image/pjp',
    'image/avif',
    'image/svg+xml',
    'image/tiff',
    'image/tif'
  ];
  
  const allowedVideoTypes = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo'
  ];

  // Get file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.jfif', '.avif', '.svg', '.tiff', '.tif', '.mp4', '.webm', '.mov', '.avi'];
  
  // Check both MIME type and file extension
  if ((allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) ||
      allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, GIF, JFIF, AVIF, SVG, TIFF, MP4, WebM, MOV, and AVI files are allowed.'), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for videos
    files: 6 // 5 images + 1 video
  }
});

// Single file upload middleware for banners
const singleUploadMiddleware = (req, res, next) => {
  upload.single('media')(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  });
};

// Middleware function for products
const uploadMiddleware = (req, res, next) => {
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 1 }
  ])(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 100MB'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum is 5 images and 1 video'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  });
};

module.exports = {
  uploadMiddleware,
  singleUploadMiddleware
}; 