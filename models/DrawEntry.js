const mongoose = require('mongoose');

const drawEntrySchema = new mongoose.Schema({
  drawId: { type: mongoose.Schema.Types.ObjectId, ref: 'Draw', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scores: [{ type: Number, min: 1, max: 45 }],
  matchCount: { type: Number, default: 0 },
}, { timestamps: true });

drawEntrySchema.index({ drawId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('DrawEntry', drawEntrySchema);
