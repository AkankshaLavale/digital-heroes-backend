const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Winner = require('../models/Winner');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();

// Multer setup for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/winners — user's own winnings
router.get('/', auth, async (req, res) => {
  try {
    const winners = await Winner.find({ userId: req.user._id })
      .populate('drawId')
      .sort({ createdAt: -1 });
    
    const totalWon = winners
      .filter(w => w.verificationStatus === 'approved')
      .reduce((sum, w) => sum + w.prizeAmount, 0);

    res.json({ winners, totalWon });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/winners/all — admin view all winners
router.get('/all', auth, admin, async (req, res) => {
  try {
    const { status, drawId } = req.query;
    const filter = {};
    if (status) filter.verificationStatus = status;
    if (drawId) filter.drawId = drawId;

    const winners = await Winner.find(filter)
      .populate('userId', 'fullName email')
      .populate('drawId')
      .sort({ createdAt: -1 });

    res.json({ winners });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/winners/:id/upload-proof — winner uploads screenshot proof
router.post('/:id/upload-proof', auth, upload.single('proof'), async (req, res) => {
  try {
    const winner = await Winner.findOne({ _id: req.params.id, userId: req.user._id });
    if (!winner) return res.status(404).json({ message: 'Winner record not found' });

    if (!req.file) return res.status(400).json({ message: 'Proof file required' });

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'golf-charity/proofs' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    winner.proofUrl = result.secure_url;
    await winner.save();

    res.json({ winner });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/winners/:id/verify — admin approve/reject
router.put('/:id/verify', auth, admin, async (req, res) => {
  try {
    const { verificationStatus } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const winner = await Winner.findByIdAndUpdate(
      req.params.id,
      { verificationStatus },
      { new: true }
    ).populate('userId', 'fullName email');

    if (!winner) return res.status(404).json({ message: 'Winner not found' });

    res.json({ winner });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/winners/:id/payout — admin mark as paid
router.put('/:id/payout', auth, admin, async (req, res) => {
  try {
    const winner = await Winner.findById(req.params.id);
    if (!winner) return res.status(404).json({ message: 'Winner not found' });

    if (winner.verificationStatus !== 'approved') {
      return res.status(400).json({ message: 'Winner must be verified before payout' });
    }

    winner.paymentStatus = 'paid';
    await winner.save();

    res.json({ winner });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
