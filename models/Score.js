const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  score: { type: Number, required: true, min: 1, max: 45 },
  playedDate: { type: Date, required: true },
}, { timestamps: true });

scoreSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Score', scoreSchema);
