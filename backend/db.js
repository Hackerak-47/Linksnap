
require("dotenv").config({ path: require('node:path').join(__dirname, '.env'), quiet: true });

const { Pool } = require("pg");


function createPool({ schema = process.env.DB_SCHEMA || 'public', ...overrides } = {}) {
if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Invalid database schema');
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 10000,
  statement_timeout: 5000,
  options: `-c search_path=${schema}`,
  ...overrides,
});


pool.on('error', () => console.error('An idle database connection failed'));
return pool;
}

module.exports = { createPool };
