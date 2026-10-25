const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const { isolatedDatabase } = require('../scripts/isolated-db');
const { createStore } = require('../store');
const { createPool } = require('../db');
const { serve, json } = require('./helpers');

test('PostgreSQL integration: HTTP CRUD, concurrent clicks, SQL search, real process restart', { skip: process.env.LINKSNAP_DB_TESTS !== '1' ? 'Run npm run test:integration with local PostgreSQL available' : false }, async t => {
  const db = await isolatedDatabase('test');
  t.after(() => db.cleanup());
  const api = await serve(createStore(db.pool), { rateLimit: 0 });
  t.after(() => api.close());
  assert.equal((await api.request('/api/health')).status, 200);
  const create = async (alias, title = alias) => {
    const res = await api.request('/api/shorten', json({ url: `https://example.com/${alias}`, customAlias: alias, title }));
    assert.equal(res.status, 201);
    return res.json();
  };
  await create('alpha', "Student's 100%_link");
  await create('bravo');
  assert.equal((await api.request('/api/shorten', json({ url: 'https://example.com', customAlias: 'alpha' }))).status, 409);
  const visits = await Promise.all(Array.from({ length: 20 }, () => api.request('/alpha')));
  assert.ok(visits.every(r => r.status === 302 && r.headers.get('location') === 'https://example.com/alpha'));
  await api.request('/alpha', { method: 'HEAD' });
  assert.equal((await api.request('/missing')).status, 404);
  assert.equal((await (await api.request('/api/links/alpha')).json()).clicks, 20);
  assert.equal((await (await api.request('/api/stats')).json()).totalClicks, 20);
  const search = await (await api.request('/api/links?search=' + encodeURIComponent("100%_"))).json();
  assert.equal(search.total, 1);
  assert.equal(search.links[0].shortCode, 'alpha');
  assert.equal((await (await api.request('/api/links?search=' + encodeURIComponent("' OR 1=1 --"))).json()).total, 0);
  const clicks = await (await api.request('/api/links?sort=clicks&limit=1')).json();
  assert.equal(clicks.links[0].shortCode, 'alpha');
  assert.equal(clicks.total, 2);
  assert.equal((await (await api.request('/api/links?sort=oldest&offset=1')).json()).links[0].shortCode, 'bravo');

  async function child(action) {
    const p = spawn(process.execPath, [path.join(__dirname, 'persistence-child.js'), action], { env: { ...process.env, DB_SCHEMA: db.schema }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    p.stdout.on('data', data => { output += data; });
    const [code] = await once(p, 'exit');
    assert.equal(code, 0, 'Persistence child failed');
    return JSON.parse(output);
  }
  assert.equal((await child('create')).status, 201);
  const restored = await child('read');
  assert.equal(restored.status, 200);
  assert.equal(restored.body.shortCode, 'restart-link');
  assert.equal((await api.request('/api/links/alpha', { method: 'DELETE' })).status, 200);
  assert.equal((await api.request('/alpha')).status, 404);
  assert.equal((await api.request('/api/links/alpha')).status, 404);
  assert.equal((await api.request('/api/links/alpha', { method: 'DELETE' })).status, 404);
});

test('PostgreSQL concurrent creation: generated codes, alias races and collision retry', { skip: process.env.LINKSNAP_DB_TESTS !== '1' }, async t => {
  const db = await isolatedDatabase('test');
  t.after(() => db.cleanup());
  const store = createStore(db.pool);
  const api = await serve(store, { rateLimit: 0 });
  t.after(() => api.close());
  const generated = await Promise.all(Array.from({ length: 30 }, async (_, i) => {
    const url = `https://example.com/concurrent/${i}`;
    const res = await api.request('/api/shorten', json({ url }));
    assert.equal(res.status, 201);
    const link = await res.json();
    assert.equal(link.originalUrl, url);
    const redirect = await api.request(`/${link.shortCode}`);
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), url);
    return link;
  }));
  assert.equal(new Set(generated.map(link => link.shortCode)).size, 30);
  const raced = await Promise.all(Array.from({ length: 20 }, () => api.request('/api/shorten', json({ url: 'https://example.com/winner', customAlias: 'contested' }))));
  assert.equal(raced.filter(res => res.status === 201).length, 1);
  assert.equal(raced.filter(res => res.status === 409).length, 19);
  for (const res of raced.filter(res => res.status === 409)) assert.deepEqual(await res.json(), { error: 'Alias already exists' });
  assert.equal((await store.list({ search: '', sort: 'newest', limit: 100, offset: 0 })).total, 31);

  let calls = 0;
  const collisionApi = await serve(store, { generateCode: () => ++calls === 1 ? 'contested' : 'retried-code' });
  t.after(() => collisionApi.close());
  const res = await collisionApi.request('/api/shorten', json({ url: 'https://example.com/retried' }));
  assert.equal(res.status, 201);
  assert.equal((await res.json()).shortCode, 'retried-code');
});

test('health returns 503 when a real PostgreSQL connection is refused', async t => {

  const probe = require('node:net').createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const pool = createPool({ host: '127.0.0.1', port, connectionTimeoutMillis: 500 });
  t.after(() => pool.end());
  const api = await serve(createStore(pool));
  t.after(() => api.close());
  const res = await api.request('/api/health');
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'Database temporarily unavailable' });
});
