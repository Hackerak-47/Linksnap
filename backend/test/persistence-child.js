const { createPool } = require('../db');
const { createStore } = require('../store');
const { serve, json } = require('./helpers');
(async () => {
  const pool = createPool();
  let api;
  try {
    api = await serve(createStore(pool));
    const res = process.argv[2] === 'create'
      ? await api.request('/api/shorten', json({ url: 'https://example.com/persistent', customAlias: 'restart-link' }))
      : await api.request('/api/links/restart-link');
    console.log(JSON.stringify({ status: res.status, body: await res.json() }));
  } finally { if (api) await api.close(); await pool.end(); }
})().catch(() => { process.exitCode = 1; });
