const fs = require('node:fs/promises');
const fmt = n => typeof n === 'number' ? n.toFixed(3) : 'NOT MEASURED';
async function writeReport(report, file) {
  const c = report.config;
  const e = report.environment;
  const rows = report.results;
  const text = `LinkSnap — performance-metrics.txt

1. PROJECT AND ENVIRONMENT
Status: ${report.status}
Started: ${report.startedAt} (UTC); display timezone Asia/Calcutta:
${new Date(report.startedAt).toLocaleString('en-IN', { timeZone: 'Asia/Calcutta' })} IST
Finished: ${report.finishedAt || 'Not completed'}
${e ? Object.entries(e).map(([k, v]) => `${k}: ${v}`).join('\n') : 'Database unavailable; no successful benchmark environment recorded.'}
Setup failure: ${report.failure || 'None'}
Cleanup: ${report.cleanup || 'No schema created'}
Backend/load generator share the host. Database uses its local endpoint;
record whether Docker/WSL/native before making comparisons. No secrets recorded.

2. PERFORMANCE GOALS AND METRIC DEFINITIONS
Correctness goal: 100% expected statuses AND validated bodies/redirect locations;
zero timeouts. This is a target, not a result unless measured below.
Initial exploratory latency goal: p95 < 100 ms at the configured paced load.
Average = sum of latencies / sample count; p50 = median; p95/p99 = the latency at
or below which 95%/99% of observed requests finish. Maximum is an outlier-sensitive
observation, not a guaranteed bound. Units: milliseconds.
RPS = completed attempts / elapsed measurement seconds, including drain/pacing.
Successful RPS counts only responses passing status AND content checks.
Error rate = all failed attempts / total; HTTP error rate counts >=400 responses;
timeout rate counts requests exceeding the 3000 ms wall-clock deadline. Network
and body validation failures are separate. Expected 302 redirects are successes.
CPU = backend process CPU time / wall time * 100 (100% means one logical core).
RSS = sampled peak resident backend memory, every 100 ms; short spikes may be missed.
Database query round-trip includes pg pool acquisition, wire, execution and result
decoding; it is NOT pure SQL execution time. All queries are instrumented, adding
some overhead. Database CPU/RAM and pure SQL execution time: NOT MEASURED.
Pool connections and waiting counts are sampled at query submission.

3. BENCHMARK SCENARIOS
POST /api/shorten; GET /:shortCode; GET /api/links/:shortCode;
GET /api/links?limit=25&sort=newest; DELETE /api/links/:shortCode; GET /api/stats.
Concurrency sequence: ${c.concurrency.join(', ')}; per-client ceiling ${c.perClientRps} RPS.
Warm-up: ${c.warmupSeconds}s; measured phase: ${c.durationSeconds}s per endpoint/load level.
Pipelining: none; HTTP/1.1 keep-alive; redirects are never followed externally.
Seed: ${c.seedCount} links with realistic example.com article URLs/titles.
Create grows from 100 rows. Delete starts with max(100, ceil(duration * clients *
perClientRps) + 2 * clients) rows so each deletion targets a different valid row.
Read/redirect/list/analytics use 100 rows. The default is at most 4 clients and
100 attempted RPS. Limits reject higher load: review workload before changing code.

4. METHODOLOGY AND REPRODUCTION
From F:\\Aastha\\url_shortner\\backend:
  npm ci
  npm test
  npm run test:integration
  npm run benchmark
Exact PowerShell configuration for this run:
  $env:BENCH_DB_MODE='${c.databaseMode || 'unknown'}'
  $env:BENCH_CONCURRENCY='${c.concurrency.join(',')}'
  $env:BENCH_WARMUP='${c.warmupSeconds}'
  $env:BENCH_DURATION='${c.durationSeconds}'
  $env:BENCH_CLIENT_RPS='${c.perClientRps}'
  npm run benchmark
Uses existing backend/.env DB_* values, never prints them. PostgreSQL must be
local, available and allow CREATE SCHEMA. No running frontend/API is necessary.
The harness creates a fresh linksnap_bench_<random> schema, applies schema.sql,
forks the actual Express/pg backend on an ephemeral loopback port and runs HTTP
from a separate process. Only this isolated backend disables the create limiter.
The ordinary server retains its 60 requests/minute/IP limit.
Each warm-up and measured phase reseeds the isolated table, making initial data
scale repeatable. Warm-up samples are discarded. Database/OS caches remain warm;
fresh client connections at measurement start are included in measured latency.
Each worker sends one request at a time, then waits to respect its per-client
rate ceiling. Slow replies reduce offered load: this is a paced closed-loop test,
not an open-loop saturation test, and is subject to coordinated omission.
Latencies use performance.now() from immediately before request construction to
body completion and validation. Percentiles use sorted samples and nearest rank
ceil(p*N). Aggregate and successful-only latency summaries plus every request
sample are saved in docs/benchmark-results.json. All attempts are retained.
Warm-up failure aborts measurement. Measured failure stops increased load and
retains partial results. Schema cleanup runs in finally. Ctrl+C/hard crashes can
leave an isolated schema; inspect it before explicitly dropping that schema.
Never drop public, truncate application tables, or delete database volumes.

Primary tool: the bundled Node.js paced HTTP runner (no extra install). Its small
implementation handles unique create/delete records and checks response content,
which makes this initial correctness-focused workload easy to repeat. It is not
a calibrated capacity-testing product. Autocannon is a simpler ready-made choice
for a conventional Node HTTP load test; JMeter can send HTTP requests to this
Node/Express API and does not require a Java backend. JMeter is useful for richer
GUI test plans, but adds a Java toolchain for overlapping initial measurements.
References: https://github.com/mcollina/autocannon
https://jmeter.apache.org/usermanual/build-web-test-plan.html

5. RESULTS (ms; no invented values)
Method endpoint | clients | total | success | failed | error% | avg | p50 | p95 | p99 | max | RPS | success RPS
${rows.length ? rows.map(r => `${r.method} ${r.endpoint} | ${r.concurrency} | ${r.total} | ${r.successful} | ${r.failed} | ${fmt(r.errorRatePercent)} | ${fmt(r.latencyMs.average)} | ${fmt(r.latencyMs.p50)} | ${fmt(r.latencyMs.p95)} | ${fmt(r.latencyMs.p99)} | ${fmt(r.latencyMs.max)} | ${fmt(r.rps)} | ${fmt(r.successfulRps)}`).join('\n') : 'All six endpoints at baseline and concurrent load: NOT MEASURED.'}

Resources and failure detail, per endpoint/load level:
${rows.length ? rows.map(r => `${r.name} c=${r.concurrency}: CPU(one core)=${fmt(r.resources.cpuPercentOneCore)}%; peak RSS=${fmt(r.resources.peakRssMiB)} MiB; pool max=${r.resources.maxConnections}, waiting max=${r.resources.maxWaiting}; pg round trips=${r.resources.queryCount}, avg=${fmt(r.resources.queryRoundTripMs.average)} ms, p95=${fmt(r.resources.queryRoundTripMs.p95)} ms; failures=${JSON.stringify(r.failures)}; HTTP error%=${fmt(r.failures.http / r.total * 100)}, timeout%=${fmt(r.failures.timeout / r.total * 100)}`).join('\n') : 'Backend CPU/RSS, query round-trip, pool behavior: NOT MEASURED.'}

6. BASELINE AND COMPARISON
This is a persistent-backend verification run, not a before/after optimization.
No percentage improvement is claimed. The former in-memory prototype is not a
comparable baseline. Before optimizing, archive JSON/text results. Repeat with
the same machine, DB deployment/config, source/instrumentation, seed scale,
request mix, pacing, concurrency, warm-up and duration. Repeat multiple runs and
report variation before claiming improvement. Do not compare different loads as
an optimization. This run uses one isolated endpoint at a time, not mixed traffic.

7. INTERPRETATION AND LIMITATIONS
Local development data, small datasets, one run per scenario and short duration
do not establish production scalability, high availability or traffic capacity.
The load generator competes with the backend and database for local resources.
Desktop background load is not quantified. Run benchmarks separately from builds,
tests and filesystem scans, and repeat on an otherwise idle machine before comparisons.
Paced throughput near its ceiling demonstrates handling this offered load, not
maximum RPS. No production deployment, multi-user auth, expiry, unique visitor,
geography or historical event analytics exists. Counts mean committed redirect
decisions, including bots/repeated visits; delivery/destination success cannot be
guaranteed after a network disconnect. HEAD/unknown links do not increment.
Deleting a link removes its count from aggregate statistics. SQL list/count and
stats/top reads can observe different instants during concurrent mutations.
No database restart durability test is implied by the backend process restart
test. PostgreSQL storage/volume configuration determines durability across DB
restarts. Current schema migration is additive and creates no database itself.

8. CV METRICS — VERIFIED RESULTS ONLY
${report.status === 'MEASURED' ? cv(rows, c) : 'Latency: NOT MEASURED\nThroughput: NOT MEASURED\nRequest success rate: NOT MEASURED\nDo not put unmeasured performance claims on a CV.'}
`;
  await fs.writeFile(file, text);
}
function cv(rows, config) {
  const redirect = rows.filter(r => r.name === 'redirect').at(-1);
  const total = rows.reduce((n, r) => n + r.total, 0);
  const success = rows.reduce((n, r) => n + r.successful, 0);
  return `- Measured redirect p95 latency of ${fmt(redirect.latencyMs.p95)} ms with ${redirect.concurrency} concurrent clients in a ${redirect.elapsedSeconds.toFixed(2)}-second local PostgreSQL-backed benchmark.
- Handled ${fmt(redirect.successfulRps)} successful redirects/second at a paced offered-load ceiling of ${redirect.concurrency * config.perClientRps} RPS (not a maximum-capacity result).
- Validated ${(success / total * 100).toFixed(3)}% request success across ${total} measured requests spanning six backend endpoints and the configured load levels.`;
}
module.exports = { writeReport };
