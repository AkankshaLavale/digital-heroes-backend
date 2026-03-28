const express = require('express');
const Score = require('../models/Score');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/scores — get current user's scores (latest 5, reverse chronological)
router.get('/', auth, async (req, res) => {
  try {
    const scores = await Score.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);
    res.json({ scores });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/scores — add a new score (auto-removes oldest if > 5)
router.post('/', auth, async (req, res) => {
  try {
    const { score, playedDate } = req.body;

    if (!score || score < 1 || score > 45) {
      return res.status(400).json({ message: 'Score must be between 1 and 45 (Stableford)' });
    }
    if (!playedDate) {
      return res.status(400).json({ message: 'Played date is required' });
    }

    // Create new score
    const newScore = await Score.create({
      userId: req.user._id,
      score,
      playedDate: new Date(playedDate),
    });

    // If more than 5 scores, delete the oldest
    const allScores = await Score.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    
    if (allScores.length > 5) {
      const toDelete = allScores.slice(5);
      await Score.deleteMany({ _id: { $in: toDelete.map(s => s._id) } });
    }

    // Return updated list
    const scores = await Score.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(201).json({ scores });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/scores/:id — update a score
router.put('/:id', auth, async (req, res) => {
  try {
    const { score, playedDate } = req.body;
    
    const existingScore = await Score.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existingScore) {
      return res.status(404).json({ message: 'Score not found' });
    }

    if (score !== undefined) {
      if (score < 1 || score > 45) {
        return res.status(400).json({ message: 'Score must be between 1 and 45' });
      }
      existingScore.score = score;
    }
    if (playedDate) existingScore.playedDate = new Date(playedDate);

    await existingScore.save();
    res.json({ score: existingScore });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/scores/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const score = await Score.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!score) {
      return res.status(404).json({ message: 'Score not found' });
    }
    res.json({ message: 'Score deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
