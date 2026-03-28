const mongoose = require('mongoose');

const drawSchema = new mongoose.Schema({
  drawDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'simulated', 'published'], default: 'pending' },
  winningNumbers: [{ type: Number, min: 1, max: 45 }],
  drawType: { type: String, enum: ['random', 'algorithmic'], default: 'random' },
  totalPool: { type: Number, default: 0 },
  pool5Match: { type: Number, default: 0 },
  pool4Match: { type: Number, default: 0 },
  pool3Match: { type: Number, default: 0 },
  jackpotRollover: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Draw', drawSchema);
