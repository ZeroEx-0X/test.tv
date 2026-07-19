const { Router } = require('express');
const healthRouter = require('./health');
const channelsRouter = require('./channels');
const iptvRouter = require('./iptv');
const adminRouter = require('./admin');
const publicRouter = require('./public');

const router = Router();

router.use(healthRouter);
router.get('/', (_req, res) => res.redirect(302, '/'));
router.use('/channels', channelsRouter);
router.use('/iptv', iptvRouter);

module.exports = { router, adminRouter, publicRouter };
