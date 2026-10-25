const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fork, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { isolatedDatabase } = require('./isolated-db');
const { writeReport } = require('./benchmark-report');

function number(name, fallback, min, max) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}
function summarize(values) {
  if (!values.length) return { average: null, p50: null, p95: null, p99: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const p = n => sorted[Math.ceil(n * sorted.length) - 1];
  return { average: sorted.reduce((a, b) => a + b, 0) / sorted.length, p50: p(.5), p95: p(.95), p99: p(.99), max: sorted.at(-1) };
}
function message(worker, expected, send) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Benchmark worker timeout')), 10000);
    const onMessage = data => { if (data.type === expected) finish(null, data); };
    const onExit = () => finish(new Error('Benchmark worker exited'));
    function finish(err, data) {
      clearTimeout(timer);
      worker.off('message', onMessage);
      worker.off('exit', onExit);
      worker.off('error', finish);
      err ? reject(err) : resolve(data);
    }
    worker.on('message', onMessage);
    worker.once('exit', onExit);
    worker.once('error', finish);
    if (send) worker.send({ type: send });
  });
}
function request(base, agent, spec) {
  return new Promise(resolve => {
    const start = performance.now();
    let done = false;
    const finish = result => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ...result, ms: performance.now() - start });
    };
    const req = http.request(base + spec.path, { method: spec.method, agent, headers: spec.body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(spec.body) } : {} }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('error', () => finish({ success: false, kind: 'network' }));
      res.on('end', () => {
        let valid = false;
        try { valid = spec.validate(res.statusCode, res.headers, body); } catch {                                                 }
        finish({ success: valid, status: res.statusCode, kind: valid ? null : res.statusCode >= 400 ? 'http' : 'validation' });
      });
    });
    const timer = setTimeout(() => { finish({ success: false, kind: 'timeout' }); req.destroy(); }, 3000);
    req.on('error', () => finish({ success: false, kind: 'network' }));
    req.end(spec.body);
  });
}

async function main() {
  const config = {
    warmupSeconds: number('BENCH_WARMUP', 2, 1, 10),
    durationSeconds: number('BENCH_DURATION', 5, 2, 30),
    perClientRps: number('BENCH_CLIENT_RPS', 25, 1, 25),
    concurrency: (process.env.BENCH_CONCURRENCY || '1,2,4').split(',').map(Number),
    seedCount: 100, timeoutMs: 3000, poolMax: 10,
    databaseMode: process.env.BENCH_DB_MODE || 'unknown',
  };
  if (!['docker', 'native', 'unknown'].includes(config.databaseMode)) throw new Error('BENCH_DB_MODE must be docker, native or unknown');
  if (!config.concurrency.length || config.concurrency.length > 4 || config.concurrency.some((x, i, a) => !Number.isInteger(x) || x < 1 || x > 4 || (i > 0 && x <= a[i - 1]))) throw new Error('Concurrency must increase, with values from 1 to 4');
  const report = { status: 'NOT MEASURED', startedAt: new Date().toISOString(), config, results: [] };
  const docs = path.resolve(__dirname, '../../docs');
  await fs.mkdir(docs, { recursive: true });
  let db;
  let worker;
  try {
    db = await isolatedDatabase('bench');
    const version = (await db.pool.query('SELECT version() AS version')).rows[0].version;
    const hash = createHash('sha256');
    for (const file of ['app.js', 'store.js', 'db.js', 'schema.sql', 'scripts/benchmark.js', 'scripts/benchmark-worker.js']) hash.update(await fs.readFile(path.resolve(__dirname, '..', file)));
    let npm = process.env.npm_config_user_agent?.match(/npm\/([^ ]+)/)?.[1] || 'unavailable';
    if (npm === 'unavailable') { try { npm = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim(); } catch {} }
    report.environment = {
      project: 'LinkSnap backend 1.0.0', sourceSha256: hash.digest('hex'), gitCommit: 'Unavailable: no Git repository',
      os: `${os.type()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length,
      totalRamGiB: os.totalmem() / 1024 ** 3, freeRamGiB: os.freemem() / 1024 ** 3,
      node: process.version, npm, database: version,
      databaseLocation: `Local PostgreSQL endpoint; deployment mode: ${config.databaseMode} (operator supplied; unknown if not configured)`,
      tool: 'LinkSnap paced HTTP runner v1 (Node built-in node:http)',
    };
    worker = fork(path.join(__dirname, 'benchmark-worker.js'), [], { env: { ...process.env, DB_SCHEMA: db.schema }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    const { port } = await message(worker, 'ready');
    const base = `http://127.0.0.1:${port}`;
    const scenarios = [
      { name: 'create', method: 'POST', endpoint: '/api/shorten' },
      { name: 'redirect', method: 'GET', endpoint: '/:shortCode' },
      { name: 'retrieve', method: 'GET', endpoint: '/api/links/:shortCode' },
      { name: 'list', method: 'GET', endpoint: '/api/links?limit=25&sort=newest' },
      { name: 'delete', method: 'DELETE', endpoint: '/api/links/:shortCode' },
      { name: 'analytics', method: 'GET', endpoint: '/api/stats' },
    ];
    async function seed(scenario, duration, concurrency) {

      await db.pool.query('TRUNCATE links');
      const count = scenario === 'delete' ? Math.max(100, Math.ceil(duration * config.perClientRps * concurrency) + concurrency * 2) : 100;
      await db.pool.query("INSERT INTO links (short_code, original_url, title) SELECT 'seed-' || i, 'https://example.com/articles/' || i, 'Benchmark article ' || i FROM generate_series(0, $1::int - 1) i", [count]);
      return count;
    }
    async function phase(scenario, duration, concurrency) {
      const seedCount = await seed(scenario.name, duration, concurrency);
      const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });
      const results = [];
      let sequence = 0;
      await message(worker, 'begun', 'begin');
      const start = performance.now();
      const deadline = start + duration * 1000;
      try {
        await Promise.all(Array.from({ length: concurrency }, async () => {
          while (performance.now() < deadline) {
            const iteration = performance.now();
            const index = sequence++;
            const code = `seed-${index % seedCount}`;
            let spec = { method: scenario.method, path: scenario.endpoint };
            if (scenario.name === 'create') {
              const url = `https://example.com/articles/new-${index}?source=benchmark`;
              spec.body = JSON.stringify({ url, customAlias: `created-${index}`, title: 'Benchmark article' });
              spec.validate = (s, h, b) => { const data = JSON.parse(b); return s === 201 && data.shortCode === `created-${index}` && data.originalUrl === url && data.clicks === 0; };
            } else if (scenario.name === 'redirect') {
              spec.path = `/${code}`;
              spec.validate = (s, h) => s === 302 && h.location === `https://example.com/articles/${index % seedCount}`;
            } else if (scenario.name === 'retrieve') {
              spec.path = `/api/links/${code}`;
              spec.validate = (s, h, b) => { const d = JSON.parse(b); return s === 200 && d.shortCode === code && d.originalUrl === `https://example.com/articles/${index % seedCount}` && d.clicks === 0; };
            } else if (scenario.name === 'list') {
              spec.validate = (s, h, b) => { const d = JSON.parse(b); return s === 200 && d.total === seedCount && d.links.length === 25 && d.links.every(x => x.shortCode.startsWith('seed-') && x.originalUrl.startsWith('https://example.com/articles/')); };
            } else if (scenario.name === 'delete') {
              spec.path = `/api/links/seed-${index}`;
              spec.validate = (s, h, b) => s === 200 && JSON.parse(b).deleted === true;
            } else {
              spec.validate = (s, h, b) => { const d = JSON.parse(b); return s === 200 && d.totalLinks === seedCount && d.totalClicks === 0 && d.topLink === null; };
            }
            results.push(await request(base, agent, spec));
            const remaining = 1000 / config.perClientRps - (performance.now() - iteration);
            if (remaining > 0) await delay(remaining);
          }
        }));
      } finally { agent.destroy(); }
      const elapsedSeconds = (performance.now() - start) / 1000;
      const resources = (await message(worker, 'resources', 'end')).data;
      const success = results.filter(r => r.success);
      const failures = Object.fromEntries(['http', 'timeout', 'network', 'validation'].map(k => [k, results.filter(r => r.kind === k).length]));
      const queries = summarize(resources.queryMs);
      const queryCount = resources.queryMs.length;
      delete resources.queryMs;
      return { ...scenario, concurrency, seedCount, elapsedSeconds, total: results.length, successful: success.length, failed: results.length - success.length, failures,
        errorRatePercent: (results.length - success.length) / results.length * 100,
        rps: results.length / elapsedSeconds, successfulRps: success.length / elapsedSeconds,
        latencyMs: summarize(results.map(r => r.ms)), successfulLatencyMs: summarize(success.map(r => r.ms)),
        resources: { ...resources, queryCount, queryRoundTripMs: queries },
        samples: results,
      };
    }
    for (const concurrency of config.concurrency) {
      for (const scenario of scenarios) {
        console.log(`Benchmark ${scenario.name}: ${concurrency} client(s), warm-up ${config.warmupSeconds}s, measurement ${config.durationSeconds}s`);
        const warm = await phase(scenario, config.warmupSeconds, concurrency);
        if (warm.failed) throw new Error('Warm-up validation failed; stopping load');
        const result = await phase(scenario, config.durationSeconds, concurrency);
        report.results.push(result);
        if (result.failed) throw new Error('Measured requests failed; stopping load');
      }
    }
    report.status = 'MEASURED';
    report.finishedAt = new Date().toISOString();
  } catch (error) {
    report.status = report.results.length ? 'PARTIAL' : 'NOT MEASURED';
    report.failure = ['ECONNREFUSED', 'ETIMEDOUT', '28P01', '3D000'].includes(error.code) ? error.code : 'Setup or benchmark validation failed';
    console.error(`Benchmark not completed: ${report.failure}. Check local PostgreSQL and docs/setup.txt.`);
    process.exitCode = 1;
  } finally {
    if (worker && worker.connected) {
      const exited = new Promise(resolve => worker.once('exit', resolve));
      worker.send({ type: 'stop' });
      const timer = setTimeout(() => worker.kill(), 5000).unref();
      await exited;
      clearTimeout(timer);
    }
    if (db) {
      try { await db.cleanup(); report.cleanup = 'Isolated schema removed'; }
      catch { report.cleanup = 'Cleanup failed; inspect generated linksnap_bench_ schema'; process.exitCode = 1; }
    }
    await fs.writeFile(path.join(docs, 'benchmark-results.json'), JSON.stringify(report, null, 2));
    await writeReport(report, path.join(docs, 'performance-metrics.txt'));
  }
}
if (require.main === module) main().catch(() => { console.error('Invalid benchmark configuration or report output failure'); process.exitCode = 1; });
module.exports = { summarize };
