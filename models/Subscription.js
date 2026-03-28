const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  razorpaySubscriptionId: { type: String, unique: true, sparse: true },
  razorpayCustomerId: { type: String },
  planType: { type: String, enum: ['monthly', 'yearly'], required: true },
  status: { 
    type: String, 
    enum: ['active', 'cancelled', 'lapsed', 'past_due', 'pending'], 
    default: 'pending' 
  },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },
  amount: { type: Number },
}, { timestamps: true });

subscriptionSchema.index({ userId: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
