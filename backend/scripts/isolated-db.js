const { randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createPool } = require('../db');

async function isolatedDatabase(kind) {
  if (!['test', 'bench'].includes(kind)) throw new Error('Invalid isolation type');

  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Tests/benchmarks require a local PostgreSQL host');
  const schema = `linksnap_${kind}_${randomBytes(8).toString('hex')}`;
  const admin = createPool();
  let pool;
  let created = false;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    created = true;
    pool = createPool({ schema });
    await pool.query(await fs.readFile(path.join(__dirname, '../schema.sql'), 'utf8'));
    return { schema, pool, async cleanup() {
      await pool.end();
      try { await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
      finally { await admin.end(); }
    } };
  } catch (error) {
    if (pool) await pool.end();
    try { if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    finally { await admin.end(); }
    throw error;
  }
}
module.exports = { isolatedDatabase };
