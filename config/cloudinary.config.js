const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Enhanced Cloudinary upload options
const cloudinaryOptions = {
  folder: 'perfume-store',
  resource_type: "auto",
  allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "jfif", "svg", "avif", "heic", "heif", "mp4", "webm", "mov"],
  transformation: [
    { quality: "auto:best" },
    { fetch_format: "auto" }
  ]
};

// Upload file to Cloudinary
const uploadToCloudinary = async (file, isVideo = false) => {
  try {
    const options = {
      ...cloudinaryOptions,
      folder: isVideo ? 'perfume-store/videos' : 'perfume-store/images',
      resource_type: isVideo ? "video" : "image",
      transformation: isVideo 
        ? [
            { quality: "auto" },
            { fetch_format: "auto" },
            { width: 1280 },
            { crop: "limit" }
          ]
        : cloudinaryOptions.transformation
    };

    const result = await cloudinary.uploader.upload(file.path, {
      ...options,
      resource_type: isVideo ? "video" : "image"
    });
    
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    return {
      public_id: result.public_id,
      url: result.secure_url
    };
  } catch (error) {
    // Remove file from server if upload fails
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw new Error(`Error uploading to Cloudinary: ${error.message}`);
  }
};

// Delete file from Cloudinary
const deleteFromCloudinary = async (public_id) => {
  try {
    if (public_id) {
      await cloudinary.uploader.destroy(public_id);
    }
    return true;
  } catch (error) {
    throw new Error('Error deleting from Cloudinary');
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary
}; 