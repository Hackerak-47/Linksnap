const { once } = require('node:events');
const { createApp } = require('../app');

async function serve(store, options = {}) {
  const server = createApp({ store, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    request: (path, options = {}) => fetch(base + path, { redirect: 'manual', ...options }),
    close: () => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())),
  };
}

function fakeStore() {
  const records = new Map();
  return {
    health: async () => {},
    create: async data => {
      if (records.has(data.shortCode)) throw Object.assign(new Error('duplicate'), { code: '23505' });
      const link = { ...data, clicks: 0, createdAt: new Date().toISOString() };
      records.set(data.shortCode, link);
      return link;
    },
    get: async code => records.get(code),
    redirect: async code => {
      const link = records.get(code);
      if (link) link.clicks++;
      return link;
    },
    remove: async code => records.delete(code),
    list: async () => ({ links: [...records.values()], total: records.size }),
    stats: async () => ({ totalLinks: records.size, totalClicks: [...records.values()].reduce((n, r) => n + r.clicks, 0) }),
  };
}
const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
module.exports = { serve, fakeStore, json };
