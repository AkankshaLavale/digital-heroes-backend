const express = require('express');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Score = require('../models/Score');
const Draw = require('../models/Draw');
const Winner = require('../models/Winner');
const CharityContribution = require('../models/CharityContribution');
const Charity = require('../models/Charity');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();

// GET /api/admin/stats — dashboard analytics
router.get('/stats', auth, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'subscriber' });
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
    
    const totalPrizePool = await Draw.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: null, total: { $sum: '$totalPool' } } },
    ]);

    const totalCharityContributions = await CharityContribution.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const totalDraws = await Draw.countDocuments();
    const totalWinners = await Winner.countDocuments({ verificationStatus: 'approved' });

    const totalPaidOut = await Winner.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$prizeAmount' } } },
    ]);

    res.json({
      totalUsers,
      activeSubscriptions,
      totalPrizePool: totalPrizePool[0]?.total || 0,
      totalCharityContributions: totalCharityContributions[0]?.total || 0,
      totalDraws,
      totalWinners,
      totalPaidOut: totalPaidOut[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/users — list all users
router.get('/users', auth, admin, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .populate('selectedCharity')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/users/:id — user detail with scores & subscription
router.get('/users/:id', auth, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').populate('selectedCharity');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const scores = await Score.find({ userId: user._id }).sort({ createdAt: -1 }).limit(5);
    const subscription = await Subscription.findOne({ userId: user._id, status: 'active' });
    const winnings = await Winner.find({ userId: user._id }).populate('drawId');

    res.json({ user, scores, subscription, winnings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/admin/users/:id — edit user (e.g., edit scores, manage subscription)
router.put('/users/:id', auth, admin, async (req, res) => {
  try {
    const { fullName, role, charityPercentage } = req.body;
    const updateFields = {};
    if (fullName) updateFields.fullName = fullName;
    if (role) updateFields.role = role;
    if (charityPercentage) updateFields.charityPercentage = charityPercentage;

    const user = await User.findByIdAndUpdate(req.params.id, updateFields, { new: true })
      .select('-password');
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/admin/users/:userId/scores/:scoreId — admin edit a user's score
router.put('/users/:userId/scores/:scoreId', auth, admin, async (req, res) => {
  try {
    const { score, playedDate } = req.body;
    const existingScore = await Score.findOne({ 
      _id: req.params.scoreId, 
      userId: req.params.userId 
    });
    
    if (!existingScore) return res.status(404).json({ message: 'Score not found' });

    if (score !== undefined) existingScore.score = score;
    if (playedDate) existingScore.playedDate = new Date(playedDate);
    await existingScore.save();

    res.json({ score: existingScore });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/reports/charity-contributions
router.get('/reports/charity-contributions', auth, admin, async (req, res) => {
  try {
    const contributions = await CharityContribution.aggregate([
      {
        $group: {
          _id: '$charityId',
          totalAmount: { $sum: '$amount' },
          totalContributions: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'charities',
          localField: '_id',
          foreignField: '_id',
          as: 'charity',
        },
      },
      { $unwind: '$charity' },
      { $sort: { totalAmount: -1 } },
    ]);

    res.json({ contributions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/reports/draw-statistics
router.get('/reports/draw-statistics', auth, admin, async (req, res) => {
  try {
    const draws = await Draw.find({ status: 'published' }).sort({ drawDate: -1 }).limit(12);
    
    const stats = await Promise.all(draws.map(async (draw) => {
      const entryCount = await DrawEntry.countDocuments({ drawId: draw._id });
      const winnerCount = await Winner.countDocuments({ drawId: draw._id });
      return {
        draw,
        entryCount,
        winnerCount,
      };
    }));

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
