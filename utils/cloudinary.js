const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload file to Cloudinary
const uploadToCloudinary = async (file, isVideo = false) => {
  try {
    // Determine if the file is a video based on mimetype
    const isVideoFile = file.mimetype.startsWith('video/');
    
    const options = {
      folder: isVideoFile ? 'products/videos' : 'products/images',
      resource_type: isVideoFile ? 'video' : 'image',
      allowed_formats: isVideoFile 
        ? ['mp4', 'webm', 'mov', 'avi']
        : ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: isVideoFile 
        ? [
            { quality: "auto" },
            { fetch_format: "auto" },
            { width: 1280 },
            { crop: "limit" }
          ]
        : [
            { quality: "auto:best" },
            { fetch_format: "auto" },
            { width: 1000 },
            { crop: "scale" }
          ]
    };

    if (isVideoFile) {
      options.eager = [
        { width: 300, height: 300, crop: "fill", format: "jpg" }
      ];
    }

    const result = await cloudinary.uploader.upload(file.path, options);
    
    fs.unlinkSync(file.path);
    
    return {
      type: isVideoFile ? 'video' : 'image',
      public_id: result.public_id,
      url: result.secure_url,
      thumbnail: isVideoFile ? result.eager[0].secure_url : null
    };
  } catch (error) {
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
  uploadToCloudinary,
  deleteFromCloudinary
}; 