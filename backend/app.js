const express = require('express');
const cors = require('cors');
const { randomBytes } = require('node:crypto');
const codePattern = /^[a-zA-Z0-9_-]{3,32}$/;
const reserved = new Set(['api', 'health', 'favicon']);
const fail = (res, status, error) => res.status(status).json({ error });

function createApp({ store, origins = ['http://localhost:3000'], rateLimit = 60, generateCode = () => randomBytes(6).toString('hex') }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    const origin = req.get('origin');
    if (origin && !origins.includes(origin)) return fail(res, 403, 'Origin not allowed');
    next();
  });
  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: '16kb' }));

  const clients = new Map();
  app.post('/api/shorten', (req, res, next) => {
    if (rateLimit === 0) return next();
    const now = Date.now();
    for (const [ip, value] of clients) if (value.until <= now) clients.delete(ip);
    let entry = clients.get(req.ip);
    if (!entry) {
      if (clients.size >= 10000) return fail(res, 429, 'Too many requests');
      entry = { count: 0, until: now + 60000 };
      clients.set(req.ip, entry);
    }
    if (++entry.count > rateLimit) {
      res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
      return fail(res, 429, 'Too many requests; try again later');
    }
    next();
  }, async (req, res) => {
    if (!req.is('application/json')) return fail(res, 415, 'Content-Type must be application/json');
    const body = req.body;
    if (!body || Array.isArray(body) || typeof body !== 'object') return fail(res, 400, 'Provide a JSON object');
    const { url, customAlias, title = '' } = body;
    if (typeof url !== 'string' || !url.trim() || url.length > 4096 || /[\x00-\x1f\x7f]/.test(url)) return fail(res, 400, 'Provide a URL of at most 4096 characters');
    let parsed;
    try { parsed = new URL(url.trim()); } catch { return fail(res, 400, 'Provide a valid HTTP or HTTPS URL'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.href.length > 4096) return fail(res, 400, 'Only HTTP(S) URLs without embedded credentials are allowed');
    if (typeof title !== 'string' || title.length > 200) return fail(res, 400, 'Title must be at most 200 characters');
    if (customAlias !== undefined && (typeof customAlias !== 'string' || !codePattern.test(customAlias) || reserved.has(customAlias.toLowerCase()))) return fail(res, 400, 'Alias must contain 3–32 letters, numbers, underscores or dashes and must not be reserved');
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const link = await store.create({ shortCode: customAlias || generateCode(), originalUrl: parsed.href, title: title.trim() });
        return res.status(201).json(link);
      } catch (error) {
        if (error.code !== '23505') throw error;
        if (customAlias) return fail(res, 409, 'Alias already exists');
      }
    }
    return fail(res, 503, 'Could not allocate a short code; try again');
  });
  app.get('/api/health', async (req, res) => {
    await store.health();
    res.json({ status: 'ok' });
  });
  app.get('/api/stats', async (req, res) => res.json(await store.stats()));
  app.get('/api/links', async (req, res) => {
    const { search = '', sort = 'newest', limit = '25', offset = '0' } = req.query;
    if (typeof search !== 'string' || search.length > 200 || !['newest', 'oldest', 'clicks'].includes(sort) || typeof limit !== 'string' || !/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100 || typeof offset !== 'string' || !/^\d+$/.test(offset) || Number(offset) > 1000000) return fail(res, 400, 'Invalid search, sort, limit or offset');
    res.json(await store.list({ search, sort, limit: Number(limit), offset: Number(offset) }));
  });
  app.param('shortCode', (req, res, next, code) => {
    if (!codePattern.test(code)) return fail(res, 400, 'Invalid short code');
    next();
  });
  app.get('/api/links/:shortCode', async (req, res) => {
    const link = await store.get(req.params.shortCode);
    return link ? res.json(link) : fail(res, 404, 'Short link not found');
  });
  app.delete('/api/links/:shortCode', async (req, res) => {
    return await store.remove(req.params.shortCode) ? res.json({ deleted: true }) : fail(res, 404, 'Short link not found');
  });

  app.head('/:shortCode', async (req, res) => {
    const link = await store.get(req.params.shortCode);
    return link ? res.redirect(302, link.originalUrl) : fail(res, 404, 'Short link not found');
  });
  app.get('/:shortCode', async (req, res) => {
    const link = await store.redirect(req.params.shortCode);
    return link ? res.redirect(302, link.originalUrl) : fail(res, 404, 'Short link not found');
  });
  app.use((req, res) => fail(res, 404, 'Endpoint not found'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') return fail(res, 413, 'Request body too large');
    if (error.status >= 400 && error.status < 500) return fail(res, error.status, 'Malformed request');
    if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '53300', '57014'].includes(error.code) || error.message?.includes('timeout')) return fail(res, 503, 'Database temporarily unavailable');
    console.error('Request failed');
    return fail(res, 500, 'Internal server error');
  });
  return app;
}
module.exports = { createApp };
