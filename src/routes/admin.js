const { Router } = require('express');
const path = require('path');
const { requireAdmin } = require('../middlewares/auth');
const Visitor = require('../models/Visitor');
const Channel = require('../models/Channel');

const router = Router();
const pub = (file) => path.join(__dirname, '../../public', file);

// GET /admin → redirect
router.get('/', (req, res) => {
  res.redirect(req.session && req.session.isAdmin ? '/admin/dashboard' : '/admin/login');
});

// GET /admin/login
router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.sendFile(pub('admin/login.html'));
});

// GET /admin/dashboard
router.get('/dashboard', requireAdmin, (_req, res) => {
  res.sendFile(pub('admin/dashboard.html'));
});

// GET /admin/channels
router.get('/channels', requireAdmin, (_req, res) => {
  res.sendFile(pub('admin/channels.html'));
});

// POST /admin/api/login
router.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || '';
  if (!adminPass) return res.status(500).json({ success: false, message: 'ADMIN_PASSWORD not set on server.' });
  if (username === adminUser && password === adminPass) {
    req.session.isAdmin = true;
    req.session.save(() => res.json({ success: true }));
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }
});

// POST /admin/api/logout
router.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /admin/api/analytics
router.get('/api/analytics', requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const [today, week, month, total, online, channelCount, byCountry, recentVisitors] = await Promise.all([
      Visitor.countDocuments({ lastSeen: { $gte: todayStart } }),
      Visitor.countDocuments({ lastSeen: { $gte: sevenDaysAgo } }),
      Visitor.countDocuments({ lastSeen: { $gte: thirtyDaysAgo } }),
      Visitor.countDocuments(),
      Visitor.countDocuments({ lastSeen: { $gte: fiveMinAgo } }),
      Channel.countDocuments({ active: true }),
      Visitor.aggregate([
        { $match: { country: { $ne: 'Unknown' } } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 15 },
      ]),
      Visitor.find().sort({ lastSeen: -1 }).limit(20).select('ip country city lastSeen totalVisits'),
    ]);

    res.json({ today, week, month, total, online, channelCount, byCountry, recentVisitors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /admin/api/channels — list for admin panel
router.get('/api/channels', requireAdmin, async (req, res) => {
  try {
    const { search, active } = req.query;
    const filter = {};
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (active !== undefined && active !== '') filter.active = active === 'true';
    const channels = await Channel.find(filter).sort({ order: 1, name: 1 });
    res.json(channels);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
