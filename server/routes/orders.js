const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const sendEmail = require("../utils/email");
const { protect, admin } = require("../middleware/auth");
const router = express.Router();

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
router.post("/", protect, async (req, res) => {
  try {
    console.log('Incoming order request body:', req.body); // Add this line
    console.log('Authenticated user:', req.user); // Add this line
    const {
      items,
      customerInfo,
      shippingAddress,
      billingAddress,
      paymentMethod = "credit_card",
      notes,
    } = req.body;

    // Validation
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item",
      });
    }

    if (!customerInfo || !shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Customer info and shipping address are required",
      });
    }

    // Verify products exist and calculate pricing
    let subtotal = 0;
    const orderItems = [];

    // First pass: validate all items before making any changes
    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product not found: ${item.product}`,
        });
      }

      if (!product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product is not available: ${product.name}`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`,
        });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.images[0]?.url || "",
      });
    }

    // Calculate tax and shipping
    const taxRate = 0.08; // 8% tax rate
    const tax = subtotal * taxRate;
    const shipping = subtotal > 50 ? 0 : 5.99; // Free shipping over $50
    const total = subtotal + tax + shipping;

    // Create order WITHOUT reducing stock yet
    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      customerInfo,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      pricing: {
        subtotal: Number(subtotal.toFixed(2)),
        tax: Number(tax.toFixed(2)),
        shipping: Number(shipping.toFixed(2)),
        total: Number(total.toFixed(2)),
      },
      paymentMethod,
      notes,
      status: "pending",
      paymentStatus: "pending",
    });

    // Reserve stock (optional: create a separate reservations table)
    // For now, we'll reduce stock only after successful payment
    // You can implement a reservation system here if needed

    await sendEmail(
      order.customerInfo.email,
      "🛍️ GlowGroove: Order Confirmation",
      `<p>Hi ${order.customerInfo.name},</p>
   <p>Thank you for your order <strong>${order.orderNumber}</strong>!</p>
   <p>We'll notify you as soon as it's shipped.</p>`
    );

    // Populate the order for response
    const populatedOrder = await Order.findById(order._id)
      .populate("items.product", "name images category")
      .populate("user", "name email");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: { order: populatedOrder },
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating order",
    });
  }
});

// Add a new endpoint to handle successful payment and reduce stock
router.patch("/:orderId/payment-success", protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if payment was already processed
    if (order.paymentStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "Payment already processed",
      });
    }

    // Reduce stock for each item
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      
      if (!product) {
        console.error(`Product not found: ${item.product}`);
        continue;
      }

      // Final stock check before reducing
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`,
        });
      }

      product.stock -= item.quantity;
      await product.save();
    }

    // Update order status
    order.paymentStatus = "completed";
    order.status = "processing";
    await order.save();

    res.json({
      success: true,
      message: "Payment processed successfully",
      data: { order },
    });
  } catch (error) {
    console.error("Payment processing error:", error);
    res.status(500).json({
      success: false,
      message: "Server error processing payment",
    });
  }
});

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    // Build filter
    const filter = { user: req.user.id };
    if (status) {
      filter.status = status;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const orders = await Order.find(filter)
      .populate("items.product", "name images category")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Get total count
    const total = await Order.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          current: Number(page),
          pages: totalPages,
          total,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching orders",
    });
  }
});

// @desc    Get all orders (Admin only)
// @route   GET /api/orders/admin/all
// @access  Private/Admin
router.get("/admin/all", protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { "customerInfo.name": { $regex: search, $options: "i" } },
        { "customerInfo.email": { $regex: search, $options: "i" } },
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const orders = await Order.find(filter)
      .populate("user", "name email")
      .populate("items.product", "name images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Get total count and stats
    const total = await Order.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    // Get order statistics
    const stats = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$pricing.total" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          current: Number(page),
          pages: totalPages,
          total,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        stats,
      },
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching orders",
    });
  }
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product", "name images category sku")
      .populate("user", "name email phone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user owns this order or is admin
    if (
      order.user._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    console.error("Get order error:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error fetching order",
    });
  }
});

// @desc    Update order status (Admin only)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
router.put("/:id/status", protect, admin, async (req, res) => {
  try {
    const { status, paymentStatus, trackingNumber, notes } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update order fields
    if (status) order.status = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (notes) order.notes = notes;

    // Set delivery date if status is delivered
    if (status === "delivered" && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }

    await order.save();
    if (["shipped", "delivered", "refunded"].includes(order.status)) {
      await sendEmail(
        order.customerInfo.email,
        `📦 Order Status Updated: ${order.status.toUpperCase()}`,
        `
    <h2>Your GlowGroove Order <strong>#${order.orderNumber || order._id
        }</strong> has been updated</h2>
    <p><strong>Status:</strong> ${order.status}</p>
    ${order.trackingNumber
          ? `<p><strong>Tracking:</strong> ${order.trackingNumber}</p>`
          : ""
        }
    <p>We’ll keep you posted with further updates!</p>
    <br />
    <p>Thanks for shopping with GlowGroove 💫</p>
  `
      );
    }

    const updatedOrder = await Order.findById(order._id)
      .populate("items.product", "name images")
      .populate("user", "name email");

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: { order: updatedOrder },
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating order status",
    });
  }
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
router.put("/:id/cancel", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user owns this order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check if order can be cancelled
    if (["shipped", "delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}`,
      });
    }

    // Restore product stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    // Update order status
    order.status = "cancelled";
    await order.save();
    await sendEmail(
      order.customerInfo.email,
      `🛑 Order Cancelled: #${order.orderNumber || order._id}`,
      `
    <h2>Your GlowGroove Order has been cancelled</h2>
    <p>We’ve successfully cancelled your order <strong>#${order.orderNumber || order._id}</strong>.</p>
    <p>If you have questions or need help placing a new order, feel free to reach out.</p>
    <br />
    <p>We hope to serve you again soon!</p>
  `
    );
    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: { order },
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error cancelling order",
    });
  }
});

module.exports = router;
