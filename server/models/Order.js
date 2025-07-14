const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  image: {
    type: String,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    uppercase: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  customerInfo: {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true, trim: true }
  },
  shippingAddress: {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zipCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'US' }
  },
  billingAddress: {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zipCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'US' }
  },
  pricing: {
    subtotal: { type: Number, required: true, min: [0, 'Subtotal cannot be negative'] },
    tax: { type: Number, required: true, min: [0, 'Tax cannot be negative'], default: 0 },
    shipping: { type: Number, required: true, min: [0, 'Shipping cannot be negative'], default: 0 },
    discount: { type: Number, min: [0, 'Discount cannot be negative'], default: 0 },
    total: { type: Number, required: true, min: [0, 'Total cannot be negative'] }
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      message: 'Invalid status'
    },
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: {
      values: ['pending', 'completed', 'failed', 'refunded'],
      message: 'Invalid payment status'
    },
    default: 'pending'
  },
  paymentReference: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'cash_on_delivery', 'paystack'],
    default: 'credit_card'
  },
  notes: {
    type: String,
    maxLength: [500, 'Notes cannot be more than 500 characters']
  },
  trackingNumber: { type: String, trim: true },
  estimatedDelivery: { type: Date },
  deliveredAt: { type: Date }
}, {
  timestamps: true
});

// 🔍 Efficient indexes (no duplication)
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

// 🔢 Order number generator
orderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `GG-${timestamp.slice(-8)}-${random}`;
  }
  next();
});

// 🔢 Virtual: total items
orderSchema.virtual('totalItems').get(function () {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// 📆 Virtual: age of order
orderSchema.virtual('orderAge').get(function () {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// ✅ Ensure virtuals are visible
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);