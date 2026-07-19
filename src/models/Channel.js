const { mongoose } = require('../lib/mongo');

const StreamSchema = new mongoose.Schema({
  url:       { type: String, required: true },
  label:     { type: String, default: 'Server 1' },
  type:      { type: String, default: 'auto', enum: ['auto', 'hls', 'dash', 'mp4', 'ts'] },
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

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF\s-]/g, '') // keep letters/numbers/Bengali, drop other symbols
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ChannelSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  slug:        { type: String, unique: true, sparse: true },
  logo:        { type: String, default: '' },
  description: { type: String, default: '' },
  country:     { type: String, default: '' },
  language:    { type: String, default: '' },
  categories:  { type: [String], default: ['Other'] },
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
ChannelSchema.index({ categories: 1 });
ChannelSchema.index({ country: 1 });
ChannelSchema.index({ active: 1, order: 1 });

// Generate a unique slug from the channel name (e.g. "Star Jalsha" -> "star-jalsha")
ChannelSchema.statics.generateUniqueSlug = async function (name, excludeId) {
  const base = slugify(name) || 'channel';
  let slug = base;
  let i = 1;
  // keep trying until we find a slug not used by any other channel
  while (
    await this.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
  ) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
};

// Look up a channel by its Mongo _id OR by its slug (used on the public site)
ChannelSchema.statics.findByIdOrSlug = async function (idOrSlug) {
  if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
    const byId = await this.findById(idOrSlug);
    if (byId) return byId;
  }
  return this.findOne({ slug: idOrSlug });
};

const Channel = mongoose.model('Channel', ChannelSchema);
module.exports = Channel;
