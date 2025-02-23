const Category = require('../models/Category');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const Product = require('../models/Product');

// Create category
exports.createCategory = async (req, res) => {
  try {
    // Check if user is a seller/admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only sellers can create categories'
      });
    }

    const { name, description, icon, color, bgPattern, subcategories, featured } = req.body;

    // Check if category exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      });
    }

    let imageData = {};
    if (req.file) {
      imageData = await uploadToCloudinary(req.file);
    }

    const category = new Category({
      name,
      description,
      icon,
      color,
      bgPattern,
      subcategories: JSON.parse(subcategories || '[]'),
      featured: JSON.parse(featured || '[]'),
      image: {
        public_id: imageData.public_id,
        url: imageData.url
      },
      createdBy: req.user.id
    });

    await category.save();

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required'
      });
    }

    // Get existing category
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Handle image upload with enhanced error handling
    let imageData = category.image;
    if (req.file) {
      try {
        // Delete old image if exists
        if (category.image?.public_id) {
          await deleteFromCloudinary(category.image.public_id);
        }
        // Upload new image
        imageData = await uploadToCloudinary(req.file);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Image upload failed: ${error.message}`
        });
      }
    }

    // Parse arrays from form data
    const subcategories = req.body.subcategories ? JSON.parse(req.body.subcategories) : category.subcategories;
    const featured = req.body.featured ? JSON.parse(req.body.featured) : category.featured;

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: req.body.name || category.name,
        description: req.body.description || category.description,
        icon: req.body.icon || category.icon,
        image: imageData,
        color: req.body.color || category.color,
        bgPattern: req.body.bgPattern || category.bgPattern,
        subcategories,
        featured
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: updatedCategory
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check ownership
    if (category.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this category'
      });
    }

    // Delete image from Cloudinary if exists
    if (category.image?.public_id) {
      await deleteFromCloudinary(category.image.public_id);
    }

    await category.deleteOne();

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Add this function to update category item counts
const updateCategoryItemCount = async (categoryId) => {
  try {
    const count = await Product.countDocuments({ category: categoryId });
    await Category.findByIdAndUpdate(categoryId, { items: count });
  } catch (error) {
    console.error('Error updating category item count:', error);
  }
};

// Modify getCategories to include product counts
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().populate('createdBy', 'name email');
    
    // Update item counts for all categories
    await Promise.all(categories.map(async (category) => {
      const count = await Product.countDocuments({ category: category._id });
      category.items = count;
      await category.save();
    }));

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single category
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
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
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};