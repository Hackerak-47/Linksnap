# LinkSnap

A backend-focused URL shortener using **Node.js/Express, PostgreSQL, and Next.js**.
Create short links, use optional custom aliases/titles, redirect visitors, search
and delete saved links, and view persistent redirect counts.

## Architecture

The Next.js client calls the Express API directly. `backend/server.js` checks the
database before listening; `app.js` owns validation and HTTP routes; `store.js`
contains parameterized PostgreSQL queries; `db.js` manages a pool of at most ten
connections. `schema.sql` defines the `links` table and creation-time index.

PostgreSQL is the source of truth. A primary key enforces short-code uniqueness,
including concurrent requests. Generated codes use cryptographic random bytes;
collisions retry up to five times. Clicks use one atomic SQL increment per GET
redirect. No localStorage or in-memory store is used for application persistence.
Tests use Node's built-in test runner; no extra test or benchmark dependencies.

## Prerequisites and PostgreSQL

Use Node.js 24 and npm. Verification used PostgreSQL 17.11. Start an existing local
PostgreSQL installation or Docker container. This workspace already has the
`linksnap-db` container with `postgres:17` and a persistent Docker volume:

```powershell
docker start linksnap-db
docker ps --filter name=linksnap-db
```

If Docker is not on PATH on this Windows machine, its executable is
`C:\Users\Admin\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`.
There is no repository Compose configuration; Docker is optional. Do not recreate
an existing database, remove its volume, or run `docker compose down -v`.
The existing container publishes port 5432 on all interfaces; it was preserved.
For a new local setup, bind PostgreSQL only to `127.0.0.1:5432`.

For a **fresh database only**, connect with your PostgreSQL administrator using
`psql`, then create a dedicated role/database (skip this when they already exist):

```sql
CREATE ROLE linksnap LOGIN;
\password linksnap
CREATE DATABASE linksnap OWNER linksnap;
```

`\password` prompts interactively instead of putting a password in shell history.
The test/benchmark role needs permission to create schemas in its local database.

## Configuration and running

Keep existing `.env` files. On a fresh checkout, copy `backend/.env.example` to
`backend/.env`, then enter your local credentials. These files are gitignored.

| Backend variable | Purpose/default |
| --- | --- |
| `DB_HOST`, `DB_PORT` | Local PostgreSQL endpoint, normally `127.0.0.1:5432` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Database and credentials, server only |
| `DB_SCHEMA` | `public`; custom schemas must already exist |
| `HOST`, `PORT` | API bind address/port: `127.0.0.1`, `5000` |
| `CORS_ORIGINS` | Comma-separated browser origins; default `http://localhost:3000` |

In `backend`:

```powershell
npm ci
npm run db:migrate
npm start
```

The additive migration creates the table/index if absent. It does not delete rows
or create the database. It is not a versioned upgrade system for future schema
changes. A missing database/schema prevents startup with a safe error message.

In a second terminal, in `frontend`:

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. The optional `frontend/.env.local` setting is
`NEXT_PUBLIC_API_URL=http://localhost:5000`; this is also the default. Never put DB
credentials in `NEXT_PUBLIC_*` variables. Restart/rebuild Next.js after changing
the API URL. Add any alternate browser origin, including `http://127.0.0.1:3000`,
to `CORS_ORIGINS` if you use it instead of `localhost`.

For a production frontend build: `npm run build`, then
`npm run start -- --hostname 127.0.0.1`. Express still runs separately.

## API

Base URL: `http://localhost:5000`. Errors use `{"error":"message"}`.

| Method | Route | Success |
| --- | --- | --- |
| POST | `/api/shorten` | 201: saved link |
| GET | `/:shortCode` | 302: stored destination, click incremented |
| HEAD | `/:shortCode` | 302: stored destination, no click increment |
| GET | `/api/links/:shortCode` | 200: saved link |
| GET | `/api/links` | 200: `{links,total,limit,offset}` |
| DELETE | `/api/links/:shortCode` | 200: `{deleted:true}` |
| GET | `/api/stats` | 200: `{totalLinks,totalClicks,topLink}` |
| GET | `/api/health` | 200: `{status:"ok"}` after querying the real links table |

Creation body:

```json
{"url":"https://example.com/articles/backend","customAlias":"backend-notes","title":"Backend notes"}
```

Only `url` is required. A saved link has `shortCode`, `originalUrl`, `title`,
`createdAt`, and `clicks`. URLs must use HTTP(S), contain no embedded credentials
or control characters, and fit within 4096 characters. Titles allow 200
characters. Aliases are case-sensitive, 3–32 letters/numbers/underscores/dashes;
reserved route names are rejected. Duplicate aliases return 409.

Listing accepts `search` (literal case-insensitive text, max 200 characters),
`sort=newest|oldest|clicks`, `limit=1..100` (default 25), and `offset=0..1000000`.
Example: `/api/links?search=notes&sort=clicks&limit=25&offset=0`.

Invalid input returns 400; missing records/routes 404; disallowed origins 403;
unsupported request media 415; bodies over 16 KB 413; shortening above 60 requests
per minute per IP 429 with `Retry-After`; common DB outages 503; unexpected errors
500 without SQL/stack traces. All responses use `Cache-Control: no-store`.

## Tests and verification

From `backend`:

```powershell
npm test
npm run test:integration
```

`npm test` runs HTTP boundary/measurement tests and a real connection-refusal
health check; database-dependent cases are explicitly skipped. The integration
command enables real PostgreSQL cases: HTTP CRUD, SQL search/sort, 20 simultaneous
redirects counted exactly, 30 simultaneous generated links, 20 requests racing for
one alias, collision retries, and persistence across separate backend processes.
It creates and removes only random `linksnap_test_*` schemas, not application data.
The connection-refusal check does not stop the user's database.

To run all tests in one invocation, with PostgreSQL available (PowerShell):

```powershell
$env:LINKSNAP_DB_TESTS='1'
npm test
Remove-Item Env:LINKSNAP_DB_TESTS
```

From `frontend`: `npm run lint` and `npm run build`.
Execution results and interactive-check limitations: [test-results.txt](docs/test-results.txt).

## Reproducible benchmarks

From `backend`, after tests/builds have finished:

```powershell
$env:BENCH_DB_MODE='docker'
$env:BENCH_CONCURRENCY='1,2,4'
$env:BENCH_WARMUP='2'
$env:BENCH_DURATION='5'
$env:BENCH_CLIENT_RPS='25'
npm run benchmark
```

Set `BENCH_DB_MODE` to `native` for native PostgreSQL, or leave it `unknown` when
unverified. This field records deployment metadata only. The runner rejects remote
DB hosts, creates a random `linksnap_bench_*` schema, forks the actual Express/pg
application on an ephemeral loopback port, and benchmarks all six core endpoints.
It validates status codes, JSON bodies, and redirect locations without following
redirects externally. It reseeds only its own table between warm-up/measurement
phases, excludes warm-up samples, and removes its schema on normal completion.
Hard interruption can leave a schema; inspect before removing that exact schema.

This is a paced, closed-loop test: at most four clients and 25 requests/second per
client, not a saturation test. Only the isolated benchmark server disables the
creation rate limiter. p50/p95/p99 use nearest-rank observed HTTP latencies.
The output includes request counts, errors/timeouts, successful throughput,
backend CPU/RSS, and pg query round trips (not pure SQL execution time).

Latest method/environment/results: [performance-metrics.txt](docs/performance-metrics.txt).
Raw samples: [benchmark-results.json](docs/benchmark-results.json).
Earlier results are archived under `docs/benchmarks/`; no performance improvement
is claimed from changes in machine background load.

## Scope and limitations

This is a local, single-workspace project with no authentication or ownership
isolation. CORS is not authentication. Keep the default loopback binding; public
multi-user deployment needs a separate security design. Rate limiting is
per-process and resets on restart. Links remain until deleted; no expiry exists.

Click counts represent committed redirect decisions, not unique humans or
confirmed destination loads. Bots/repeated GETs count; HEAD/unknown links do not.
Deleting a link removes its count from aggregates. List/count and stats/top-link
queries can observe slightly different instants during concurrent writes.

Settings/custom domains/webhooks/API-key controls are not implemented and have
been removed from the UI. The dashboard exposes only Overview, My Links, and
recorded Analytics. Local, short-duration benchmark results do not establish
production scalability or maximum capacity.
