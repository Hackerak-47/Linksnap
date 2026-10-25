# LinkSnap frontend

Next.js dashboard for the Express/PostgreSQL API. See the [project README](../README.md)
for database setup, architecture, API endpoints, tests, and benchmark instructions.

From this directory:

```powershell
npm ci
npm run dev
```

Open http://localhost:3000 with the backend running on port 5000. Optional
`.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:5000` (also the default).
Never place database credentials in public environment variables.

Verification: `npm run lint` and `npm run build`.
Production preview: `npm run start -- --hostname 127.0.0.1` after building.

The available views are Overview, My Links, and Analytics. Settings and unfinished
advanced controls have been removed. All saved links and counts come from the API.
