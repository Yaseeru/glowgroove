const express = require("express");
const axios = require("axios");
const { protect } = require("../middleware/auth");
const Order = require("../models/Order");

const router = express.Router();

// @route   POST /api/payments/paystack/initiate
// @access  Private
router.post('/paystack/initiate', protect, async (req, res) => {
     const { amount, email, orderId } = req.body;

     try {
          const response = await axios.post(
               'https://api.paystack.co/transaction/initialize',
               {
                    email,
                    amount: Math.round(amount * 100),
                    callback_url: 'http://localhost:3000/'
               },
               {
                    headers: {
                         Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                         'Content-Type': 'application/json'
                    }
               }
          );

          const { reference } = response.data.data;

          // 🛠️ Update the order with the reference
          if (orderId) {
               await Order.findByIdAndUpdate(orderId, { paymentReference: reference });
          }

          res.json({
               success: true,
               data: response.data.data // contains authorization_url, reference, etc.
          });
     } catch (error) {
          console.error('Paystack init error:', error.response?.data || error.message);
          res.status(500).json({
               success: false,
               message: 'Payment initialization failed'
          });
     }
});

// @route   POST /api/payments/paystack/webhook
router.post(
  '/paystack/webhook',
  express.json({ verify: (req, res, buf) => { req.rawBody = buf } }),
  async (req, res) => {
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody)
      .digest('hex');
    
    if (hash !== req.headers['x-paystack-signature']) {
      return res.sendStatus(401);
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const { reference, amount, customer } = event.data;
      
      try {
        // Update order status
        const order = await Order.findOneAndUpdate(
          { paymentReference: reference },
          { 
            paymentStatus: 'paid',
            paidAt: new Date(),
            paymentAmount: amount / 100 // Convert back from kobo
          },
          { new: true }
        ).populate('user', 'email name');

        if (order) {
          console.log(`💰 Payment verified for order ${order._id}`);
          // TODO: Send confirmation email
        }
      } catch (err) {
        console.error('Webhook error:', err);
      }
    }

    res.sendStatus(200);
  }
);

router.get('/verify', protect, async (req, res) => {
  const { reference } = req.query;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const order = await Order.findOneAndUpdate(
      { paymentReference: reference },
      { paymentStatus: 'paid' },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed'
    });
  }
});

module.exports = router;