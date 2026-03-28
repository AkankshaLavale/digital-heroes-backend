const express = require('express');
const Charity = require('../models/Charity');
const CharityContribution = require('../models/CharityContribution');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();

// GET /api/charities — list all charities (public)
router.get('/', async (req, res) => {
  try {
    const { search, featured } = req.query;
    const filter = {};
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (featured === 'true') filter.featured = true;

    const charities = await Charity.find(filter).sort({ featured: -1, name: 1 });
    res.json({ charities });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/charities/:id — single charity with contribution total
router.get('/:id', async (req, res) => {
  try {
    const charity = await Charity.findById(req.params.id);
    if (!charity) return res.status(404).json({ message: 'Charity not found' });

    const totalContributions = await CharityContribution.aggregate([
      { $match: { charityId: charity._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.json({
      charity,
      totalContributions: totalContributions[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/charities — admin create
router.post('/', auth, admin, async (req, res) => {
  try {
    const charity = await Charity.create(req.body);
    res.status(201).json({ charity });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/charities/:id — admin update
router.put('/:id', auth, admin, async (req, res) => {
  try {
    const charity = await Charity.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!charity) return res.status(404).json({ message: 'Charity not found' });
    res.json({ charity });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/charities/:id — admin delete
router.delete('/:id', auth, admin, async (req, res) => {
  try {
    const charity = await Charity.findByIdAndDelete(req.params.id);
    if (!charity) return res.status(404).json({ message: 'Charity not found' });
    res.json({ message: 'Charity deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/charities/:id/donate — independent donation
router.post('/:id/donate', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount required' });
    }

    const charity = await Charity.findById(req.params.id);
    if (!charity) return res.status(404).json({ message: 'Charity not found' });

    const contribution = await CharityContribution.create({
      userId: req.user._id,
      charityId: charity._id,
      amount,
      source: 'donation',
    });

    res.status(201).json({ contribution });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
