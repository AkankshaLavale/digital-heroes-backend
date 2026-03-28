const express = require('express');
const Draw = require('../models/Draw');
const DrawEntry = require('../models/DrawEntry');
const Score = require('../models/Score');
const Winner = require('../models/Winner');
const Subscription = require('../models/Subscription');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { generateRandomNumbers, generateAlgorithmicNumbers, countMatches, calculatePrizePool } = require('../utils/drawEngine');
const router = express.Router();

// GET /api/draws — list draws (published ones for users, all for admin)
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { status: 'published' };
    const draws = await Draw.find(filter).sort({ drawDate: -1 }).limit(20);
    res.json({ draws });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/draws/:id — single draw with entries
router.get('/:id', auth, async (req, res) => {
  try {
    const draw = await Draw.findById(req.params.id);
    if (!draw) return res.status(404).json({ message: 'Draw not found' });

    let entries = [];
    if (req.user.role === 'admin') {
      entries = await DrawEntry.find({ drawId: draw._id }).populate('userId', 'fullName email');
    } else {
      entries = await DrawEntry.find({ drawId: draw._id, userId: req.user._id });
    }

    const winners = await Winner.find({ drawId: draw._id }).populate('userId', 'fullName email');

    res.json({ draw, entries, winners });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/draws — admin create new draw
router.post('/', auth, admin, async (req, res) => {
  try {
    const { drawDate, drawType } = req.body;

    // Calculate total pool from active subscriptions
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
    const totalPool = activeSubscriptions * 999 * 0.7; // 70% of subscription goes to prize pool

    const draw = await Draw.create({
      drawDate: new Date(drawDate),
      drawType: drawType || 'random',
      totalPool,
    });

    // Auto-enter all active subscribers
    const subscribers = await Subscription.find({ status: 'active' }).populate('userId');
    for (const sub of subscribers) {
      const userScores = await Score.find({ userId: sub.userId._id })
        .sort({ createdAt: -1 })
        .limit(5);

      if (userScores.length === 5) {
        await DrawEntry.create({
          drawId: draw._id,
          userId: sub.userId._id,
          scores: userScores.map(s => s.score),
        });
      }
    }

    res.status(201).json({ draw });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/draws/:id/simulate — admin simulate draw
router.post('/:id/simulate', auth, admin, async (req, res) => {
  try {
    const draw = await Draw.findById(req.params.id);
    if (!draw) return res.status(404).json({ message: 'Draw not found' });
    if (draw.status === 'published') {
      return res.status(400).json({ message: 'Draw already published' });
    }

    // Generate winning numbers
    let winningNumbers;
    if (draw.drawType === 'algorithmic') {
      const entries = await DrawEntry.find({ drawId: draw._id });
      const allScores = entries.flatMap(e => e.scores);
      winningNumbers = generateAlgorithmicNumbers(allScores);
    } else {
      winningNumbers = generateRandomNumbers();
    }

    // Calculate matches for all entries
    const entries = await DrawEntry.find({ drawId: draw._id });
    for (const entry of entries) {
      entry.matchCount = countMatches(entry.scores, winningNumbers);
      await entry.save();
    }

    // Calculate prize pools
    const { pool5Match, pool4Match, pool3Match } = calculatePrizePool(
      draw.totalPool, draw.jackpotRollover
    );

    draw.winningNumbers = winningNumbers;
    draw.status = 'simulated';
    draw.pool5Match = pool5Match;
    draw.pool4Match = pool4Match;
    draw.pool3Match = pool3Match;
    await draw.save();

    // Preview winners
    const winners5 = entries.filter(e => e.matchCount >= 5);
    const winners4 = entries.filter(e => e.matchCount === 4);
    const winners3 = entries.filter(e => e.matchCount === 3);

    res.json({
      draw,
      preview: {
        winningNumbers,
        winners5: winners5.length,
        winners4: winners4.length,
        winners3: winners3.length,
        pool5Match,
        pool4Match,
        pool3Match,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/draws/:id/publish — admin publish results
router.post('/:id/publish', auth, admin, async (req, res) => {
  try {
    const draw = await Draw.findById(req.params.id);
    if (!draw) return res.status(404).json({ message: 'Draw not found' });
    if (draw.status !== 'simulated') {
      return res.status(400).json({ message: 'Draw must be simulated first' });
    }

    const entries = await DrawEntry.find({ drawId: draw._id });

    // Create winner records
    const matchTiers = [
      { min: 5, type: '5-match', pool: draw.pool5Match },
      { min: 4, max: 4, type: '4-match', pool: draw.pool4Match },
      { min: 3, max: 3, type: '3-match', pool: draw.pool3Match },
    ];

    let has5Winner = false;

    for (const tier of matchTiers) {
      const tierWinners = entries.filter(e => {
        if (tier.max) return e.matchCount === tier.min;
        return e.matchCount >= tier.min;
      });

      if (tierWinners.length > 0) {
        if (tier.type === '5-match') has5Winner = true;
        const prizePerWinner = tier.pool / tierWinners.length;

        for (const winner of tierWinners) {
          await Winner.create({
            drawId: draw._id,
            userId: winner.userId,
            matchType: tier.type,
            prizeAmount: prizePerWinner,
          });
        }
      }
    }

    // Jackpot rollover if no 5-match winner
    if (!has5Winner) {
      draw.jackpotRollover = draw.pool5Match;
    }

    draw.status = 'published';
    await draw.save();

    const winners = await Winner.find({ drawId: draw._id }).populate('userId', 'fullName email');
    res.json({ draw, winners });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
