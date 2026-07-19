const { mongoose } = require('../lib/mongo');

const VisitorSchema = new mongoose.Schema({
  ip:          { type: String, required: true, unique: true },
  country:     { type: String, default: 'Unknown' },
  city:        { type: String, default: 'Unknown' },
  firstSeen:   { type: Date, default: Date.now },
  lastSeen:    { type: Date, default: Date.now },
  totalVisits: { type: Number, default: 1 },
});

VisitorSchema.index({ lastSeen: -1 });
VisitorSchema.index({ country: 1 });

const Visitor = mongoose.model('Visitor', VisitorSchema);
module.exports = Visitor;
