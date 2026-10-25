const fs = require('node:fs/promises');
const path = require('node:path');
const { createPool } = require('../db');
async function main() {
  const pool = createPool();
  try {
    await pool.query(await fs.readFile(path.join(__dirname, '../schema.sql'), 'utf8'));
    console.log('Links schema ready');
  } catch {
    console.error('Migration failed; check database configuration and permissions');
    process.exitCode = 1;
  } finally { await pool.end(); }
}
main();
