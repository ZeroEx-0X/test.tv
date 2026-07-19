const http = require('http');
const Visitor = require('../models/Visitor');

const SKIP_PREFIXES = ['/api/', '/admin', '/static', '/favicon'];

function getGeoLocation(ip) {
  return new Promise((resolve) => {
    const url = `http://ip-api.com/json/${ip}?fields=status,country,city`;
    const req = http.get(url, { timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk.toString()));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.status === 'success') {
            resolve({ country: data.country || 'Unknown', city: data.city || 'Unknown' });
          } else {
            resolve({ country: 'Unknown', city: 'Unknown' });
          }
        } catch {
          resolve({ country: 'Unknown', city: 'Unknown' });
        }
      });
      res.on('error', () => resolve({ country: 'Unknown', city: 'Unknown' }));
    });
    req.on('error', () => resolve({ country: 'Unknown', city: 'Unknown' }));
    req.on('timeout', () => { req.destroy(); resolve({ country: 'Unknown', city: 'Unknown' }); });
  });
}

function visitorTracker(req, _res, next) {
  if (req.method !== 'GET' || SKIP_PREFIXES.some((p) => req.path.startsWith(p))) {
    next(); return;
  }
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.ip;
  const ip = (rawIp || '').trim().replace(/^::ffff:/, '');
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') { next(); return; }

  setImmediate(async () => {
    try {
      const existing = await Visitor.findOne({ ip });
      if (existing) {
        await Visitor.updateOne({ ip }, { $set: { lastSeen: new Date() }, $inc: { totalVisits: 1 } });
      } else {
        const geo = await getGeoLocation(ip);
        await Visitor.create({ ip, country: geo.country, city: geo.city, firstSeen: new Date(), lastSeen: new Date(), totalVisits: 1 });
      }
    } catch { /* silent */ }
  });
  next();
}

module.exports = { visitorTracker };
