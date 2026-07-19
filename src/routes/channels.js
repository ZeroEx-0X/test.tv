const { Router } = require('express');
const Channel = require('../models/Channel');
const { requireAdmin } = require('../middlewares/auth');

const router = Router();

// GET /api/channels
router.get('/', async (req, res) => {
  try {
    const { category, country, language, search, active } = req.query;
    const filter = {};
    if (category && category !== '__all__') filter.category = category;
    if (country && country !== '__all__') filter.country = country;
    if (language && language !== '__all__') filter.language = language;
    if (active !== undefined) filter.active = active === 'true';
    if (search) filter.name = { $regex: search, $options: 'i' };
    const channels = await Channel.find(filter).sort({ order: 1, name: 1 });
    res.json(channels);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/channels/meta
router.get('/meta', async (_req, res) => {
  try {
    const [categories, countries, languages] = await Promise.all([
      Channel.distinct('category'),
      Channel.distinct('country'),
      Channel.distinct('language'),
    ]);
    res.json({
      categories: categories.filter(Boolean).sort(),
      countries: countries.filter(Boolean).sort(),
      languages: languages.filter(Boolean).sort(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/channels/stats
router.get('/stats', requireAdmin, async (_req, res) => {
  try {
    const [total, active, hidden] = await Promise.all([
      Channel.countDocuments(),
      Channel.countDocuments({ active: true }),
      Channel.countDocuments({ active: false }),
    ]);
    res.json({ success: true, total, active, hidden });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/channels/:id  (accepts a Mongo _id OR a channel slug/name-url)
router.get('/:id', async (req, res) => {
  try {
    const ch = await Channel.findByIdOrSlug(req.params.id);
    if (!ch) return res.status(404).json({ success: false, message: 'Not found' });
    const obj = ch.toObject();
    obj.reportCount = (obj.reports || []).length;
    delete obj.reports; // don't expose IPs publicly
    res.json(obj);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/channels
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, logo, description, country, language, category, tags, streams, active, featured } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });
    if (!streams || !streams.length) return res.status(400).json({ success: false, message: 'at least one stream is required' });
    const last = await Channel.findOne().sort({ order: -1 });
    const slug = await Channel.generateUniqueSlug(name);
    const ch = await Channel.create({
      name, slug, logo: logo || '', description: description || '',
      country: country || '', language: language || '',
      category: category || 'Other',
      tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []),
      streams, active: active !== false, featured: !!featured,
      order: last ? (last.order || 0) + 1 : 0,
    });
    res.json({ success: true, channel: ch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/channels/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, logo, description, country, language, category, tags, streams, active, featured } = req.body;
    const update = {
      name, logo, description, country, language, category,
      tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []),
      streams, active, featured, updatedAt: new Date(),
    };
    if (name) {
      const existing = await Channel.findById(req.params.id);
      // only regenerate the slug if the name actually changed (or it never had one)
      if (existing && (existing.name !== name || !existing.slug)) {
        update.slug = await Channel.generateUniqueSlug(name, req.params.id);
      }
    }
    const ch = await Channel.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!ch) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, channel: ch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/channels/:id/report  (public — IP-deduped)
router.post('/:id/report', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const ch = await Channel.findByIdOrSlug(req.params.id);
    if (!ch) return res.status(404).json({ success: false, message: 'Not found' });
    const already = ch.reports.some(r => r.ip === ip);
    if (already) return res.json({ success: true, alreadyReported: true, count: ch.reports.length });
    ch.reports.push({ ip });
    await ch.save();
    res.json({ success: true, count: ch.reports.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/channels/:id/report  (admin — clears all reports = "fixed")
router.delete('/:id/report', requireAdmin, async (req, res) => {
  try {
    const ch = await Channel.findById(req.params.id);
    if (!ch) return res.status(404).json({ success: false, message: 'Not found' });
    ch.reports = [];
    await ch.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/channels/:id/toggle
router.patch('/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const ch = await Channel.findById(req.params.id);
    if (!ch) return res.status(404).json({ success: false, message: 'Not found' });
    ch.active = !ch.active;
    ch.updatedAt = new Date();
    await ch.save();
    res.json({ success: true, active: ch.active });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/channels/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const ch = await Channel.findByIdAndDelete(req.params.id);
    if (!ch) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: `"${ch.name}" deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
