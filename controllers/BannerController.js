const Banner = require('../models/Banner');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary.config');

exports.createBanner = async (req, res) => {
  try {
    const { title, description, buttonText, buttonLink, order } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a media file'
      });
    }

    // Upload to Cloudinary
    const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
    const uploadResult = await uploadToCloudinary(file, mediaType === 'video');

    const banner = new Banner({
      title,
      description,
      buttonText,
      buttonLink,
      order: order || 0,
      media: {
        public_id: uploadResult.public_id,
        url: uploadResult.url,
        type: mediaType
      },
      createdBy: req.user.id
    });

    await banner.save();

    res.status(201).json({
      success: true,
      banner
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getBanners = async (req, res) => {
  try {
    const banners = await Banner.find()
      .sort({ order: 1, createdAt: -1 });
    
    res.status(200).json({
      success: true,
      banners
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const { title, description, buttonText, order, isActive } = req.body;
    const bannerId = req.params.id;
    
    const banner = await Banner.findById(bannerId);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Update media if new file is uploaded
    if (req.file) {
      // Delete old media from Cloudinary
      await deleteFromCloudinary(banner.media.public_id);
      
      // Upload new media
      const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      const uploadResult = await uploadToCloudinary(req.file, mediaType === 'video');
      
      banner.media = {
        public_id: uploadResult.public_id,
        url: uploadResult.url,
        type: mediaType
      };
    }

    // Update other fields
    banner.title = title || banner.title;
    banner.description = description || banner.description;
    banner.buttonText = buttonText || banner.buttonText;
    banner.order = order !== undefined ? order : banner.order;
    banner.isActive = isActive !== undefined ? isActive : banner.isActive;

    await banner.save();

    res.status(200).json({
      success: true,
      banner
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Delete media from Cloudinary
    await deleteFromCloudinary(banner.media.public_id);
    
    // Delete banner from database
    await banner.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
