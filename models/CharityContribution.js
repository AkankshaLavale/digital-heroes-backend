const mongoose = require('mongoose');

const charityContributionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  charityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Charity', required: true },
  amount: { type: Number, required: true },
  source: { type: String, enum: ['subscription', 'donation'], required: true },
}, { timestamps: true });

charityContributionSchema.index({ userId: 1 });
charityContributionSchema.index({ charityId: 1 });

module.exports = mongoose.model('CharityContribution', charityContributionSchema);
