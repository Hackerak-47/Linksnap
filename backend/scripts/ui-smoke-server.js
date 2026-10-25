
const { isolatedDatabase } = require('./isolated-db');
const { createStore } = require('../store');
const { createApp } = require('../app');
const { createInterface } = require('node:readline');
(async () => {
  const db = await isolatedDatabase('test');
  let closing = false;
  const input = createInterface({ input: process.stdin });
  const server = createApp({ store: createStore(db.pool) }).listen(5000, '127.0.0.1', () => console.log('Isolated browser-test API listening on 127.0.0.1:5000; press Enter to stop and clean up'));
  const stop = async () => {
    if (closing) return;
    closing = true;
    input.close();
    server.close(async () => { await db.cleanup(); });
  };
  server.on('error', async () => { input.close(); console.error('Browser-test API could not listen'); await db.cleanup(); process.exitCode = 1; });
  input.once('line', stop);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch(() => { console.error('Browser-test database setup failed'); process.exitCode = 1; });
