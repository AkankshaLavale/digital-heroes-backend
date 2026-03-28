const express = require('express');
const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const CharityContribution = require('../models/CharityContribution');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/subscriptions/plans — available plans
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'monthly',
        name: 'Monthly Plan',
        price: 999, // in paise (₹9.99 or adjust as needed)
        interval: 'monthly',
        razorpayPlanId: process.env.RAZORPAY_PLAN_MONTHLY,
      },
      {
        id: 'yearly',
        name: 'Yearly Plan',
        price: 9999,
        interval: 'yearly',
        description: 'Save 17%!',
        razorpayPlanId: process.env.RAZORPAY_PLAN_YEARLY,
      },
    ],
  });
});

// POST /api/subscriptions/create — create a Razorpay subscription
router.post('/create', auth, async (req, res) => {
  try {
    const { planType } = req.body; // 'monthly' | 'yearly'
    const planId = planType === 'yearly'
      ? process.env.RAZORPAY_PLAN_YEARLY
      : process.env.RAZORPAY_PLAN_MONTHLY;

    if (!planId) {
      return res.status(400).json({ message: 'Plan not configured' });
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: planType === 'yearly' ? 10 : 120, // max billing cycles
      notes: { userId: req.user._id.toString() },
    });

    // Save pending subscription
    await Subscription.create({
      userId: req.user._id,
      razorpaySubscriptionId: subscription.id,
      planType,
      status: 'pending',
    });

    res.json({
      subscriptionId: subscription.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/subscriptions/verify — verify payment after checkout
router.post('/verify', auth, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    // Update subscription status
    const subscription = await Subscription.findOneAndUpdate(
      { razorpaySubscriptionId: razorpay_subscription_id },
      {
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
      },
      { new: true }
    );

    // Record charity contribution
    const user = await User.findById(req.user._id);
    if (user.selectedCharity) {
      const amount = (subscription.amount || 999) * (user.charityPercentage / 100);
      await CharityContribution.create({
        userId: user._id,
        charityId: user.selectedCharity,
        amount,
        source: 'subscription',
      });
    }

    res.json({ message: 'Payment verified', subscription });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/subscriptions/status — current user's subscription
router.get('/status', auth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      status: { $in: ['active', 'pending'] },
    }).sort({ createdAt: -1 });

    res.json({ subscription: subscription || null, isActive: subscription?.status === 'active' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/subscriptions/cancel
router.post('/cancel', auth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      status: 'active',
    });

    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    // Cancel in Razorpay
    if (subscription.razorpaySubscriptionId) {
      await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId);
    }

    subscription.status = 'cancelled';
    await subscription.save();

    res.json({ message: 'Subscription cancelled', subscription });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/subscriptions/webhook — Razorpay webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (webhookSecret) {
      const signature = req.headers['x-razorpay-signature'];
      const expectedSignature = crypto.createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(400).json({ message: 'Invalid webhook signature' });
      }
    }

    const { event, payload } = req.body;

    switch (event) {
      case 'subscription.activated':
        await Subscription.findOneAndUpdate(
          { razorpaySubscriptionId: payload.subscription.entity.id },
          { status: 'active' }
        );
        break;
      case 'subscription.cancelled':
        await Subscription.findOneAndUpdate(
          { razorpaySubscriptionId: payload.subscription.entity.id },
          { status: 'cancelled' }
        );
        break;
      case 'subscription.halted':
      case 'subscription.pending':
        await Subscription.findOneAndUpdate(
          { razorpaySubscriptionId: payload.subscription.entity.id },
          { status: 'lapsed' }
        );
        break;
    }

    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
