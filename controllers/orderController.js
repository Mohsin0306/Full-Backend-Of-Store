const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { createNotification, createOrderCancellationNotification } = require('./notificationController');
const Buyer = require('../models/Buyer');

exports.createOrder = async (req, res) => {
  try {
    const {
      shippingAddress,
      paymentMethod,
      paymentDetails
    } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ buyer: req.user.id })
      .populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Verify stock availability
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${item.product.name}`
        });
      }
    }

    // Create order
    const order = new Order({
      buyer: req.user.id,
      seller: cart.items[0].product.seller, // Assuming all products are from same seller
      items: cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.price
      })),
      shippingAddress,
      paymentMethod,
      paymentDetails: {
        ...paymentDetails,
        status: paymentMethod === 'cod' ? 'pending' : 'completed'
      },
      totalAmount: cart.totalAmount
    });

    await order.save();

    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity }
      });
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    // Notify buyer about successful order creation
    await createNotification(
      [req.user.id],
      'ORDER_STATUS',
      'Order Placed Successfully',
      `Your order #${order.orderId} has been placed successfully`,
      {
        orderId: order._id,
        orderStatus: 'pending'
      }
    );

    // Notify seller about new order
    await createNotification(
      [order.seller],
      'NEW_ORDER',
      'New Order Received',
      `You have received a new order #${order.orderId}`,
      {
        orderId: order._id,
        orderStatus: 'pending'
      }
    );

    res.status(201).json({
      success: true,
      order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { status, sort } = req.query;
    
    // Build query for buyer's orders
    let query = { buyer: req.user.id };  // Changed from seller to buyer
    
    if (status && status !== 'all') {
      query.status = status;
    }

    // Execute query with proper population
    let orders = await Order.find(query)
      .populate({
        path: 'items.product',
        select: 'name price media',
        model: 'Product'
      })
      .populate('seller', 'name')  // Add seller information
      .sort({ createdAt: -1 });

    // Transform orders for response
    const transformedOrders = orders.map(order => {
      const orderObj = order.toObject();
      return {
        ...orderObj,
        items: orderObj.items.map(item => {
          // Find first image from product media
          const firstImage = item.product?.media?.find(m => m.type === 'image');
          return {
            ...item,
            product: {
              ...item.product,
              imageUrl: firstImage?.url || null
            }
          };
        })
      };
    });

    res.json({
      success: true,
      orders: transformedOrders
    });
  } catch (error) {
    console.error('Error in getOrders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate({
        path: 'items.product',
        select: 'name price media',
        model: 'Product'
      })
      .populate('buyer', 'name email')
      .populate('seller', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify user has access to this order (either buyer or seller)
    if (order.buyer._id.toString() !== req.user.id && 
        order.seller._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Transform the order data to include image URLs
    const transformedOrder = {
      ...order.toObject(),
      items: order.items.map(item => ({
        ...item,
        product: {
          ...item.product,
          imageUrl: item.product.media?.[0]?.url || null
        }
      }))
    };

    res.json({
      success: true,
      order: transformedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    console.log('Cancelling order:', req.params.id);
    
    const order = await Order.findById(req.params.id)
      .populate('buyer', 'name')
      .populate('seller', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify user owns this order
    if (order.buyer._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update order
    order.status = 'cancelled';
    order.cancelReason = req.body.cancelReason || 'Customer requested cancellation';
    
    // Create notifications before saving order
    try {
      console.log('Creating cancellation notifications');
      await createOrderCancellationNotification(order, order.buyer.name);
      
      // Also notify the seller
      await createNotification(
        [order.seller._id],
        'ORDER_CANCELLED',
        'Order Cancelled',
        `Order #${order.orderId} has been cancelled by ${order.buyer.name}`,
        {
          orderId: order._id,
          buyerId: order.buyer._id,
          orderStatus: 'cancelled',
          orderNumber: order.orderId,
          cancelReason: order.cancelReason
        }
      );
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }

    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    console.log('Order cancelled successfully');
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling order',
      error: error.message
    });
  }
};

exports.getAdminOrders = async (req, res) => {
  try {
    const { 
      status, 
      search, 
      sort = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 20
    } = req.query;
    
    // Build query
    let query = { seller: req.user.id };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    // Add search functionality
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'shippingAddress.firstName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.lastName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.city': { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    // Build sort object
    const sortObj = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;

    // Execute query with pagination and sorting
    const orders = await Order.find(query)
      .populate({
        path: 'items.product',
        select: 'name price media status',
        match: { status: { $ne: null } } // Only populate products that exist
      })
      .populate('buyer', 'name email phoneNumber')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    // Safely transform orders with null check
    const transformedOrders = orders.map(order => {
      const orderObj = order.toObject();
      return {
        ...orderObj,
        items: orderObj.items.map(item => {
          // Handle case where product might be null or deleted
          if (!item.product) {
            return {
              ...item,
              product: {
                name: 'Product Unavailable',
                price: item.price,
                imageUrl: null
              }
            };
          }

          // Safely get image URL
          const imageUrl = item.product.media && 
                         Array.isArray(item.product.media) && 
                         item.product.media.length > 0
            ? item.product.media.find(m => m.type === 'image')?.url
            : null;

          return {
            ...item,
            product: {
              ...item.product,
              imageUrl
            }
          };
        })
      };
    });

    res.json({
      success: true,
      orders: transformedOrders,
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    });

  } catch (error) {
    console.error('Error in getAdminOrders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin orders',
      error: error.message
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, cancelReason } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate('buyer')
      .populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify seller owns this order
    if (order.seller.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate status transition
    const validTransitions = {
      pending: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered', 'cancelled'],
      delivered: [], // No further transitions allowed
      cancelled: [] // No further transitions allowed
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition order from ${order.status} to ${status}`
      });
    }

    // Create status update notification with detailed message
    const statusMessages = {
      processing: `Your order #${order.orderId} is now being processed and will be shipped soon.`,
      shipped: `Great news! Your order #${order.orderId} has been shipped and is on its way.`,
      delivered: `Your order #${order.orderId} has been successfully delivered. Thank you for shopping with us!`,
      cancelled: `Your order #${order.orderId} has been cancelled${cancelReason ? `: ${cancelReason}` : ''}.`
    };

    if (statusMessages[status]) {
      await createNotification(
        [order.buyer._id],
        'ORDER_STATUS',
        `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        statusMessages[status],
        {
          orderId: order._id,
          orderStatus: status
        }
      );
    }

    // Handle cancellation
    if (status === 'cancelled') {
      if (!cancelReason) {
        return res.status(400).json({
          success: false,
          message: 'Cancellation reason is required'
        });
      }
      order.cancelReason = cancelReason;

      // Restore product stock
      for (const item of order.items) {
        if (item.product) {
          await Product.findByIdAndUpdate(item.product._id, {
            $inc: { stock: item.quantity }
          });
        }
      }
    }

    // Update order status
    order.status = status;
    await order.save();

    // Populate necessary fields for response
    await order.populate([
      {
        path: 'items.product',
        select: 'name price media'
      },
      {
        path: 'buyer',
        select: 'name email'
      }
    ]);

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message
    });
  }
}; 