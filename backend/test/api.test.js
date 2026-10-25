const { test } = require('node:test');
const assert = require('node:assert/strict');
const { serve, fakeStore, json } = require('./helpers');

async function fixture(t, store = fakeStore(), options = {}) {
  const api = await serve(store, options);
  t.after(() => api.close());
  return api;
}
test('creation preserves normalized URL, title, custom alias and returns 201', async t => {
  const api = await fixture(t);
  const res = await api.request('/api/shorten', json({ url: ' https://example.com ', title: ' Example ', customAlias: 'my-link' }));
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.originalUrl, 'https://example.com/');
  assert.equal(data.shortCode, 'my-link');
  assert.equal(data.title, 'Example');
  assert.equal(data.clicks, 0);
});
test('missing, non-string, oversized and unsafe URLs return JSON 400', async t => {
  const api = await fixture(t);
  for (const url of [undefined, null, 123, {}, [], '', ' ', 'not a url', 'javascript:alert(1)', 'ftp://example.com', 'https://user:pass@example.com', 'https://example.com/\nheader', 'https://example.com/' + 'x'.repeat(4096)]) {
    const res = await api.request('/api/shorten', json({ url }));
    assert.equal(res.status, 400);
    assert.equal(typeof (await res.json()).error, 'string');
  }
});
test('body types, malformed JSON, missing content type and payload limit', async t => {
  const api = await fixture(t);
  for (const body of [null, [], 'text', 42]) assert.equal((await api.request('/api/shorten', json(body))).status, 400);
  assert.equal((await api.request('/api/shorten', { method: 'POST' })).status, 415);
  const malformed = await api.request('/api/shorten', { ...json({}), body: '{' });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: 'Malformed request' });
  assert.equal((await api.request('/api/shorten', json({ url: 'x'.repeat(20000) }))).status, 413);
});
test('aliases and titles are validated; duplicate aliases return 409', async t => {
  const api = await fixture(t);
  for (const customAlias of ['', 'a', '../abc', 'api', 'a'.repeat(33), {}, null]) assert.equal((await api.request('/api/shorten', json({ url: 'https://example.com', customAlias }))).status, 400);
  for (const title of [null, {}, 'x'.repeat(201)]) assert.equal((await api.request('/api/shorten', json({ url: 'https://example.com', title }))).status, 400);
  const body = json({ url: 'https://example.com', customAlias: 'unique' });
  assert.equal((await api.request('/api/shorten', body)).status, 201);
  assert.equal((await api.request('/api/shorten', body)).status, 409);
});
test('generated code collisions retry and have a bounded exhaustion response', async t => {
  const store = fakeStore();
  await store.create({ shortCode: 'taken', originalUrl: 'https://example.com/', title: '' });
  let n = 0;
  const api = await fixture(t, store, { generateCode: () => ++n === 1 ? 'taken' : 'fresh' });
  assert.equal((await (await api.request('/api/shorten', json({ url: 'https://example.com' }))).json()).shortCode, 'fresh');
  const exhausted = await fixture(t, store, { generateCode: () => 'taken' });
  assert.equal((await exhausted.request('/api/shorten', json({ url: 'https://example.com' }))).status, 503);
});
test('retrieve, redirect, HEAD, missing code, delete and post-delete retrieval', async t => {
  const api = await fixture(t);
  await api.request('/api/shorten', json({ url: 'https://example.com/path', customAlias: 'sample' }));
  assert.equal((await api.request('/api/links/sample')).status, 200);
  const redirect = await api.request('/sample');
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'https://example.com/path');
  assert.equal(redirect.headers.get('cache-control'), 'no-store');
  assert.equal((await api.request('/sample', { method: 'HEAD' })).status, 302);
  for (const path of ['/missing', '/api/links/missing', '/constructor', '/__proto__']) assert.equal((await api.request(path)).status, 404);
  assert.equal((await (await api.request('/api/stats')).json()).totalClicks, 1);
  assert.equal((await (await api.request('/api/links/sample')).json()).clicks, 1);
  assert.equal((await api.request('/api/links/sample', { method: 'DELETE' })).status, 200);
  for (const path of ['/sample', '/api/links/sample']) assert.equal((await api.request(path)).status, 404);
  assert.equal((await api.request('/api/links/sample', { method: 'DELETE' })).status, 404);
});
test('list parameters are validated and passed as typed values', async t => {
  const store = fakeStore();
  let captured;
  store.list = async args => { captured = args; return { links: [], total: 0 }; };
  const api = await fixture(t, store);
  assert.equal((await api.request('/api/links?search=hello&sort=clicks&limit=10&offset=20')).status, 200);
  assert.deepEqual(captured, { search: 'hello', sort: 'clicks', limit: 10, offset: 20 });
  for (const query of ['sort=DROP', 'limit=0', 'limit=101', 'limit=1.5', 'offset=-1', 'offset=1000001', 'search=a&search=b', 'search=' + 'x'.repeat(201)]) assert.equal((await api.request('/api/links?' + query)).status, 400);
  assert.equal((await api.request('/api/links/ab')).status, 400);
  assert.equal((await api.request('/api/links/%E0%A4%A')).status, 400);
});
test('CORS rejects unapproved origins and permits the configured frontend', async t => {
  const api = await fixture(t);
  assert.equal((await api.request('/api/health', { headers: { Origin: 'https://evil.example' } })).status, 403);
  const res = await api.request('/api/health', { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(res.status, 200);
});
test('shortening rate limit returns 429 with retry information', async t => {
  const api = await fixture(t, fakeStore(), { rateLimit: 1 });
  await api.request('/api/shorten', json({ url: 'https://example.com' }));
  const res = await api.request('/api/shorten', json({ url: 'https://example.com' }));
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get('retry-after')) > 0);
  assert.equal((await api.request('/api/health')).status, 200);
});
test('database failures return safe errors without leaked details', async t => {
  const store = fakeStore();
  store.health = async () => { throw Object.assign(new Error('secret credentials'), { code: 'ECONNREFUSED' }); };
  store.get = async () => { throw new Error('secret SQL stack'); };
  const api = await fixture(t, store);
  const health = await api.request('/api/health');
  assert.equal(health.status, 503);
  assert.deepEqual(await health.json(), { error: 'Database temporarily unavailable' });
  const res = await api.request('/api/links/sample');
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'Internal server error' });
});
