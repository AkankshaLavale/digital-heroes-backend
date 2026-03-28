const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
  drawId: { type: mongoose.Schema.Types.ObjectId, ref: 'Draw', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  matchType: { type: String, enum: ['5-match', '4-match', '3-match'], required: true },
  prizeAmount: { type: Number, default: 0 },
  proofUrl: { type: String, default: '' },
  verificationStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
}, { timestamps: true });

winnerSchema.index({ drawId: 1 });
winnerSchema.index({ userId: 1 });

module.exports = mongoose.model('Winner', winnerSchema);
