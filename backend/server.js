const { createPool } = require('./db');
const { createStore } = require('./store');
const { createApp } = require('./app');

async function start() {
  const pool = createPool();
  const store = createStore(pool);
  let server;
  try {
    await store.health();
    const port = Number(process.env.PORT || 5000);
    const origins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(x => x.trim());
    server = createApp({ store, origins }).listen(port, process.env.HOST || '127.0.0.1', () => console.log(`LinkSnap listening on port ${port}`));
    server.on('error', async () => { console.error('Server could not listen'); await pool.end(); process.exitCode = 1; });
  } catch {
    console.error('Startup failed: check database configuration and run npm run db:migrate');
    await pool.end();
    process.exitCode = 1;
    return;
  }
  let closing = false;
  const stop = () => {
    if (closing) return;
    closing = true;
    const timer = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => { await pool.end(); clearTimeout(timer); });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
if (require.main === module) start();
module.exports = { start };
