const { mongoose } = require('../lib/mongo');

const StreamSchema = new mongoose.Schema({
  url:       { type: String, required: true },
  label:     { type: String, default: 'Server 1' },
  type:      { type: String, default: 'auto', enum: ['auto', 'hls', 'dash', 'mp4'] },
  referer:   { type: String, default: '' },
  origin:    { type: String, default: '' },
  userAgent: { type: String, default: '' },
  drmKey:    { type: String, default: '' },
  useProxy:  { type: Boolean, default: false },
}, { _id: false });

const ReportSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  reportedAt: { type: Date, default: Date.now },
}, { _id: false });

const ChannelSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  logo:        { type: String, default: '' },
  description: { type: String, default: '' },
  country:     { type: String, default: '' },
  language:    { type: String, default: '' },
  category:    { type: String, default: 'Other' },
  tags:        { type: [String], default: [] },
  streams:     { type: [StreamSchema], default: [] },
  reports:     { type: [ReportSchema], default: [] },
  order:       { type: Number, default: 0 },
  active:      { type: Boolean, default: true },
  featured:    { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

ChannelSchema.index({ name: 1 });
ChannelSchema.index({ category: 1 });
ChannelSchema.index({ country: 1 });
ChannelSchema.index({ active: 1, order: 1 });

const Channel = mongoose.model('Channel', ChannelSchema);
module.exports = Channel;
