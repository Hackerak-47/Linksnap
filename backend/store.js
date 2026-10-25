
const columns = 'short_code AS "shortCode", original_url AS "originalUrl", title, created_at AS "createdAt", clicks::float8 AS clicks';
function createStore(pool) {
  return {
    async health() { await pool.query('SELECT short_code FROM links LIMIT 0'); },
    async create({ shortCode, originalUrl, title }) {
      const { rows } = await pool.query(`INSERT INTO links (short_code, original_url, title) VALUES ($1,$2,$3) RETURNING ${columns}`, [shortCode, originalUrl, title]);
      return rows[0];
    },
    async get(code) {
      return (await pool.query(`SELECT ${columns} FROM links WHERE short_code=$1`, [code])).rows[0];
    },
    async redirect(code) {

      return (await pool.query(`UPDATE links SET clicks=clicks+1 WHERE short_code=$1 RETURNING ${columns}`, [code])).rows[0];
    },
    async remove(code) {
      return (await pool.query('DELETE FROM links WHERE short_code=$1 RETURNING short_code', [code])).rowCount > 0;
    },
    async list({ search, sort, limit, offset }) {
      const order = { newest: 'created_at DESC', oldest: 'created_at ASC', clicks: 'clicks DESC' }[sort];
      if (!order) throw new Error('Invalid sort');
      const where = "strpos(lower(short_code || ' ' || original_url || ' ' || title), lower($1)) > 0";
      const { rows } = await pool.query(`SELECT ${columns} FROM links WHERE ${where} ORDER BY ${order}, short_code ASC LIMIT $2 OFFSET $3`, [search, limit, offset]);
      const count = await pool.query(`SELECT count(*)::int AS total FROM links WHERE ${where}`, [search]);
      return { links: rows, total: count.rows[0].total, limit, offset };
    },
    async stats() {
      const { rows } = await pool.query('SELECT count(*)::int AS "totalLinks", COALESCE(sum(clicks),0)::float8 AS "totalClicks" FROM links');
      const top = await pool.query(`SELECT ${columns} FROM links WHERE clicks>0 ORDER BY clicks DESC, short_code ASC LIMIT 1`);
      return { ...rows[0], topLink: top.rows[0] || null };
    },
  };
}
module.exports = { createStore };
