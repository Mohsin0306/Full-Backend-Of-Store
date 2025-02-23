const Product = require('../models/Product');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const mongoose = require('mongoose');
const { createNotification } = require('./notificationController');
const Buyer = require('../models/Buyer');

const cleanSubcategories = (subcategories) => {
  if (!subcategories) return [];
  
  try {
    const parsed = typeof subcategories === 'string' 
      ? JSON.parse(subcategories) 
      : subcategories;
    
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Take only the first subcategory and clean it
      const firstSub = parsed[0];
      let cleanedSub = firstSub;
      
      // Keep parsing until we get a clean string
      while (typeof cleanedSub === 'string' && 
             (cleanedSub.startsWith('[') || cleanedSub.startsWith('"'))) {
        cleanedSub = JSON.parse(cleanedSub);
      }
      
      return [typeof cleanedSub === 'string' 
        ? cleanedSub.trim() 
        : String(cleanedSub)];
    }
    return [];
  } catch (error) {
    console.error('Error parsing subcategories:', error);
    return [];
  }
};

const notifyFollowers = async (product, type, title, message, data = {}) => {
  try {
    const buyers = await Buyer.find();
    if (buyers.length > 0) {
      await createNotification(
        buyers.map(buyer => buyer._id),
        type,
        title,
        message,
        { productId: product._id, ...data }
      );
    }
  } catch (error) {
    console.error('Error sending notifications:', error);
  }
};

exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      brand,
      stock,
      status,
      specifications,
      features
    } = req.body;

    let subcategories = [];
    if (req.body.subcategories) {
      try {
        subcategories = JSON.parse(req.body.subcategories);
      } catch (error) {
        subcategories = [req.body.subcategories];
      }
    }

    let media = [];
    
    // Handle image uploads
    if (req.files && req.files.images) {
      const imageUploadPromises = req.files.images.map(file => 
        uploadToCloudinary(file, false)
      );
      const uploadedImages = await Promise.all(imageUploadPromises);
      media = [...media, ...uploadedImages];
    }

    // Handle video upload
    if (req.files && req.files.videos) {
      const videoUploadPromises = req.files.videos.map(file => 
        uploadToCloudinary(file, true)
      );
      const uploadedVideos = await Promise.all(videoUploadPromises);
      media = [...media, ...uploadedVideos];
    }

    // Create product with provided status
    const product = await Product.create({
      name,
      description,
      price,
      category,
      subcategories,
      brand,
      stock,
      status: status || 'draft',
      specifications: JSON.parse(specifications || '[]'),
      features: JSON.parse(features || '[]'),
      media,
      seller: req.user.id
    });

    // Notify about new product if it's published
    if (product.status === 'published') {
      await notifyFollowers(
        product,
        'NEW_PRODUCT',
        'New Product Available',
        `Check out our new product: ${product.name}`
      );
    }

    res.status(201).json({
      success: true,
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check for price decrease only
    if (req.body.price && req.body.price < product.price) {
      await notifyFollowers(
        product,
        'PRICE_DROP',
        'Price Drop Alert!',
        `The price of ${product.name} has dropped from $${product.price} to $${req.body.price}`,
        {
          oldPrice: product.price,
          newPrice: req.body.price
        }
      );
    }

    // Check for stock updates
    if (req.body.stock !== undefined) {
      const newStock = parseInt(req.body.stock);
      const oldStock = product.stock;

      // Notify if stock was 0 and now available
      if (oldStock === 0 && newStock > 0) {
        await notifyFollowers(
          product,
          'STOCK_UPDATE',
          'Back in Stock',
          `${product.name} is back in stock with ${newStock} units available!`
        );
      }
      // Notify if stock is running low (less than or equal to 5)
      else if (newStock <= 5 && newStock > 0 && oldStock > 5) {
        await notifyFollowers(
          product,
          'STOCK_UPDATE',
          'Low Stock Alert',
          `Only ${newStock} units left of ${product.name}! Get it before it's gone.`
        );
      }
    }

    // Initialize media array with existing media from the product
    let media = [...product.media];

    // Handle removed media
    if (req.body.removedMedia) {
      try {
        const removedMediaIds = JSON.parse(req.body.removedMedia);
        // Remove items from media array
        media = media.filter(item => !removedMediaIds.includes(item.public_id));
        // Delete from cloudinary
        for (const publicId of removedMediaIds) {
          await deleteFromCloudinary(publicId);
        }
      } catch (error) {
        console.error('Error processing removedMedia:', error);
      }
    }

    // Handle new uploads
    if (req.files && req.files.images) {
      const imageUploadPromises = req.files.images.map(file => 
        uploadToCloudinary(file, false)
      );
      const uploadedImages = await Promise.all(imageUploadPromises);
      media = [...media, ...uploadedImages];
    }

    // Process subcategories
    let subcategories = [];
    if (req.body.subcategories) {
      try {
        subcategories = JSON.parse(req.body.subcategories);
      } catch (error) {
        subcategories = [req.body.subcategories];
      }
    }

    // Update product with clean data
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        category: req.body.category,
        brand: req.body.brand,
        stock: req.body.stock,
        status: req.body.status || product.status, // Keep existing status if not provided
        specifications: JSON.parse(req.body.specifications || '[]'),
        features: JSON.parse(req.body.features || '[]'),
        subcategories,
        media
      },
      { new: true, runValidators: true }
    ).populate('category');

    res.json({
      success: true,
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    let query = {};
    
    // If seller (admin) is requesting, show their products
    if (req.user && req.user.role === 'seller') {
      query = { seller: req.user.id };
    }

    // Get all products for this seller
    const products = await Product.find(query)
      .populate('category')
      .populate('seller', 'name')
      .sort({ createdAt: -1 }); // Sort by newest first

    // Calculate metrics
    const metrics = {
      totalProducts: products.length,
      productsWithOrders: products.filter(p => p.orderCount > 0).length,
      totalOrders: products.reduce((sum, p) => sum + (p.orderCount || 0), 0),
      averageOrders: products.length ? products.reduce((sum, p) => sum + (p.orderCount || 0), 0) / products.length : 0
    };

    // Sort products by orderCount and viewCount for topSales and trending
    const topSales = [...products].sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0)).slice(0, 15);
    const trending = [...products].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 15);

    res.json({
      success: true,
      data: {
        topSales,
        trending
      },
      metrics
    });

  } catch (error) {
    console.error('Error in getProducts:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const now = new Date();
      const product = await Product.findById(req.params.id).session(session);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Always increment view count for better trending calculation
      await Product.findByIdAndUpdate(
        req.params.id,
        { 
          $inc: { viewCount: 1 },
          lastViewedAt: now
        },
        { session }
      );

      await session.commitTransaction();

      const updatedProduct = await Product.findById(req.params.id)
        .populate('category', 'name')
        .populate('seller', 'name');

      res.json({
        success: true,
        product: updatedProduct
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      seller: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unauthorized'
      });
    }

    // Delete media from Cloudinary
    if (product.media && product.media.length > 0) {
      for (const mediaItem of product.media) {
        if (mediaItem.public_id) {
          await deleteFromCloudinary(mediaItem.public_id);
        }
      }
    }

    // Delete the product
    await Product.deleteOne({ _id: req.params.id });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const products = await Product.find({ 
      category: categoryId,
      status: 'published' // Only get published products
    })
    .populate('category')
    .populate('seller', 'name');

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Make sure this is being called when orders are created
exports.incrementOrderCount = async (productId) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $inc: { orderCount: 1 } },
      { new: true }
    );
    console.log(`Updated order count for product ${productId}:`, updatedProduct.orderCount);
    return updatedProduct;
  } catch (error) {
    console.error('Error incrementing order count:', error);
    throw error;
  }
};

exports.searchProducts = async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query) {
      return res.json({
        success: true,
        data: [] // Return empty array instead of error
      });
    }

    // Create search criteria
    const searchCriteria = {
      status: 'published',
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } },
        { subcategories: { $regex: query, $options: 'i' } }
      ]
    };

    // Fetch products with populated category
    const products = await Product.find(searchCriteria)
      .populate('category', 'name')
      .sort({ orderCount: -1, viewCount: -1 })
      .limit(20);

    res.json({
      success: true,
      data: products || [] // Ensure we always return an array
    });

  } catch (error) {
    console.error('Search error:', error);
    res.json({
      success: true,
      data: [] // Return empty array on error
    });
  }
};

exports.getSearchSuggestions = async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query || query.length < 1) {
      // Get popular searches (based on most viewed and ordered products)
      const popularProducts = await Product.aggregate([
        { $match: { status: 'published' } },
        {
          $addFields: {
            popularity: { $add: ['$orderCount', '$viewCount'] }
          }
        },
        { $sort: { popularity: -1 } },
        { $limit: 8 },
        {
          $project: {
            _id: 0,
            name: 1,
            brand: 1
          }
        }
      ]);

      return res.json({
        success: true,
        suggestions: [],
        popularSearches: popularProducts.map(p => p.name)
      });
    }

    // Real-time search suggestions
    const suggestions = await Product.aggregate([
      {
        $match: {
          status: 'published',
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { brand: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          names: { $addToSet: '$name' },
          brands: { $addToSet: '$brand' }
        }
      },
      {
        $project: {
          _id: 0,
          suggestions: {
            $concatArrays: ['$names', '$brands']
          }
        }
      }
    ]);

    // Get unique suggestions and limit to 8
    const uniqueSuggestions = [...new Set(
      suggestions[0]?.suggestions || []
    )].slice(0, 8);

    res.json({
      success: true,
      suggestions: uniqueSuggestions,
      popularSearches: []
    });

  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting suggestions',
      error: error.message
    });
  }
}; 