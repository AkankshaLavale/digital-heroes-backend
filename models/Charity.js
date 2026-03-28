const mongoose = require('mongoose');

const charitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  websiteUrl: { type: String, default: '' },
  featured: { type: Boolean, default: false },
  events: [{
    title: String,
    description: String,
    date: Date,
    imageUrl: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('Charity', charitySchema);
