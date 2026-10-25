
const { createPool } = require('../db');
const { createStore } = require('../store');
const { createApp } = require('../app');
if (!/^linksnap_bench_[a-f0-9]{16}$/.test(process.env.DB_SCHEMA || '')) throw new Error('An isolated benchmark schema is required');
const pool = createPool();
const query = pool.query.bind(pool);
let measuring = false;
let queryMs = [];
let maxConnections = 0;
let maxWaiting = 0;
let peakRss = 0;
let startCpu;
let startTime;
pool.query = async (...args) => {
  const start = performance.now();
  const pending = query(...args);
  maxConnections = Math.max(maxConnections, pool.totalCount);
  maxWaiting = Math.max(maxWaiting, pool.waitingCount);
  try { return await pending; }
  finally { if (measuring) queryMs.push(performance.now() - start); }
};
const sampler = setInterval(() => {
  if (measuring) peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 100).unref();
const server = createApp({ store: createStore(pool), rateLimit: 0 }).listen(0, '127.0.0.1', () => process.send({ type: 'ready', port: server.address().port }));
process.on('message', async message => {
  if (message.type === 'begin') {
    queryMs = [];
    peakRss = process.memoryUsage().rss;
    maxConnections = pool.totalCount;
    maxWaiting = 0;
    startCpu = process.cpuUsage();
    startTime = performance.now();
    measuring = true;
    process.send({ type: 'begun' });
  } else if (message.type === 'end') {
    measuring = false;
    const cpu = process.cpuUsage(startCpu);
    const elapsed = performance.now() - startTime;
    process.send({ type: 'resources', data: {
      cpuPercentOneCore: ((cpu.user + cpu.system) / 1000) / elapsed * 100,
      peakRssMiB: peakRss / 1024 / 1024,
      maxConnections, maxWaiting, queryMs,
    } });
  } else if (message.type === 'stop') {
    clearInterval(sampler);
    server.close(async () => { await pool.end(); process.disconnect(); });
  }
});
process.on('disconnect', () => { server.close(); pool.end().catch(() => {}); });
