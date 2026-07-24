const { Router } = require('express');
const http = require('http');
const https = require('https');
const Channel = require('../models/Channel');

const router = Router();

// GET /api/iptv/channels
router.get('/channels', async (req, res) => {
  try {
    const { category, country, language, search } = req.query;
    const filter = { active: true };
    if (category && category !== '__all__') filter.$or = [{ categories: category }, { category }];
    if (country && country !== '__all__') filter.country = country;
    if (language && language !== '__all__') filter.language = language;
    if (search) filter.name = { $regex: search, $options: 'i' };
    const channels = await Channel.find(filter).sort({ order: 1, name: 1 });

    // backfill: older channels created before slugs/categories existed won't have them yet
    for (const c of channels) {
      let needsSave = false;
      if (!c.slug) {
        c.slug = await Channel.generateUniqueSlug(c.name, c._id);
        needsSave = true;
      }
      if (!c.categories || !c.categories.length) {
        const legacy = c._doc && c._doc.category;
        c.categories = legacy ? [legacy] : ['Other'];
        needsSave = true;
      }
      if (needsSave) await c.save();
    }

    res.json(channels.map(c => ({
      _id: c._id,
      slug: c.slug,
      name: c.name,
      logo: c.logo,
      country: c.country,
      language: c.language,
      categories: c.categories,
      featured: c.featured,
      streams: c.streams,
    })));
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/iptv/meta
router.get('/meta', async (_req, res) => {
  try {
    const [categories, legacyCategories, countries, languages] = await Promise.all([
      Channel.distinct('categories', { active: true }),
      Channel.distinct('category', { active: true }),
      Channel.distinct('country', { active: true }),
      Channel.distinct('language', { active: true }),
    ]);
    res.json({
      categories: [...new Set([...categories, ...legacyCategories])].filter(Boolean).sort(),
      countries: countries.filter(Boolean).sort(),
      languages: languages.filter(Boolean).sort(),
    });
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Proxy helper with redirect following
function fetchWithRedirect(url, extraHeaders = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (url.startsWith('https') ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': extraHeaders['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        ...(extraHeaders.referer ? { 'Referer': extraHeaders.referer } : {}),
        ...(extraHeaders.origin ? { 'Origin': extraHeaders.origin } : {}),
      },
      timeout: 15000,
    };
    const req = lib.request(opts, (upstream) => {
      // Connection succeeded — this is a live stream that can run for hours,
      // so stop the inactivity timeout from killing it mid-playback.
      req.setTimeout(0);
      if ([301, 302, 303, 307, 308].includes(upstream.statusCode) && upstream.headers.location) {
        const location = upstream.headers.location;
        const nextUrl = location.startsWith('http') ? location : new URL(location, url).toString();
        upstream.resume();
        resolve(fetchWithRedirect(nextUrl, extraHeaders, redirectCount + 1));
        return;
      }
      resolve(upstream);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

// GET /api/iptv/proxy?url=...&referer=...&ua=...
router.get('/proxy', async (req, res) => {
  const streamUrl = req.query.url;
  if (!streamUrl) return res.status(400).send('url param required');

  let parsed;
  try {
    parsed = new URL(streamUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).send('Invalid protocol');
  } catch {
    return res.status(400).send('Invalid URL');
  }

  const extraHeaders = {
    referer: req.query.referer || '',
    origin: req.query.origin || '',
    'user-agent': req.query.ua || '',
  };

  try {
    const upstream = await fetchWithRedirect(streamUrl, extraHeaders);
    const ct = upstream.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store');

    const isM3U8 = streamUrl.includes('.m3u8') || ct.includes('mpegurl') || ct.includes('m3u');
    if (isM3U8) {
      let body = '';
      upstream.setEncoding('utf8');
      upstream.on('data', (chunk) => (body += chunk));
      upstream.on('end', () => {
        const base = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
        const fixed = body.split('\n').map((line) => {
          const trim = line.trim();
          if (!trim || trim.startsWith('#')) return line;
          const uriMatch = line.match(/URI="([^"]+)"/);
          if (uriMatch) {
            const keyUrl = /^https?:\/\//i.test(uriMatch[1]) ? uriMatch[1] : base + uriMatch[1];
            return line.replace(uriMatch[1], `/api/iptv/proxy?url=${encodeURIComponent(keyUrl)}`);
          }
          const absUrl = /^https?:\/\//i.test(trim) ? trim : base + trim;
          return `/api/iptv/proxy?url=${encodeURIComponent(absUrl)}`;
        }).join('\n');
        res.send(fixed);
      });
      upstream.on('error', () => { if (!res.headersSent) res.status(502).end(); });
    } else {
      if (upstream.headers['content-length']) res.setHeader('Content-Length', upstream.headers['content-length']);
      upstream.pipe(res);
      upstream.on('error', () => { if (!res.headersSent) res.status(502).end(); });
    }
  } catch (err) {
    if (!res.headersSent) res.status(502).send('Proxy error: ' + err.message);
  }
});

module.exports = router;
