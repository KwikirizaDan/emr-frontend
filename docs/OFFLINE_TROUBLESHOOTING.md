# Offline Troubleshooting Guide

Working on this EMR without internet. Everything below runs **locally**: Next.js (frontend) →
same-origin BFF → Flask (`emr-api`) → PostgreSQL. This file maps the error messages you are most
likely to see to their cause and fix.

> Windows / PowerShell commands are used throughout (this project runs on Windows).

---

## 0. Offline checklist (do this before debugging anything)

| Thing | Why it matters offline |
| --- | --- |
| `node_modules/` exists | You **cannot** `npm install` without internet. If it's missing, restore from cache (see §2.3). |
| `.env.local` exists in `emr-frontend` | Holds `FLASK_API_BASE_URL` and `SESSION_SECRET`. |
| `.env` exists in `emr-api\emr-api` | Holds `DATABASE_URL`, `TEST_DATABASE_URL`, secrets. |
| PostgreSQL is running | Both frontend and backend are dead without it. |
| Databases exist | `emr_dev` and `emr_test`. |
| `.venv\Scripts\python.exe` exists | Python deps are already installed. |
| `.next/` cache exists | Needed so `next/font/google` doesn't try to fetch fonts (see §3.1). |

**Start order:** PostgreSQL → `flask run` (API on `:5000`) → `next dev` (frontend on `:3000`).
Starting Next first is the #1 cause of "Unable to reach the EMR service" (§3.5).

Turn Next.js telemetry off once (it tries to phone home):

```powershell
npx next telemetry disable
```

---

## 1. Environment / configuration errors

| Error message | Cause | Fix |
| --- | --- | --- |
| `FLASK_API_BASE_URL is not configured. Copy .env.example to .env.local and set it.` | No `.env.local` (or the var is blank) in `emr-frontend`. | Create `emr-frontend\.env.local` with `FLASK_API_BASE_URL=http://localhost:5000` and `SESSION_SECRET=<any-long-string>`. Restart `next dev`. |
| `SESSION_SECRET must be set outside development.` | `NODE_ENV=production` (or a production build) with no `SESSION_SECRET`. | Set `SESSION_SECRET` in `.env.local`, or run in dev (`next dev`). |
| `Unable to reach the EMR service. Check your connection and try again.` | Flask is not running, or `FLASK_API_BASE_URL` is wrong/points at nothing. | Start the API first (§4), and confirm the URL/port. `curl http://localhost:5000/api/v1/health`. |
| App boots but every login redirects back to `/login` | Cookie not being set (missing secret / wrong env). | Ensure `SESSION_SECRET` is set and you are on `http://localhost:3000` (not `127.0.0.1`), then log in again. |

Both `FLASK_API_BASE_URL` and `SESSION_SECRET` are **server-only** — never prefix them with
`NEXT_PUBLIC_`.

---

## 2. Node / npm / install errors (offline)

### 2.1 `'next' is not recognized` / `Cannot find module 'next'`

`node_modules` is missing or incomplete.

```powershell
# install strictly from the local npm cache, no network
npm install --offline --no-audit --no-fund
```

If that fails because the cache is empty and you have no internet, copy a `node_modules` folder
from another machine with the same `package-lock.json`, or restore a backup.

### 2.2 `npm ERR! network` / `getaddrinfo EAI_AGAIN`

npm is trying to reach the registry. For the scripts you actually use (`dev`, `build`,
`typecheck`), no network is needed once `node_modules` is present. Avoid `npm install`/`npm update`
while offline. `npm run typecheck` and `npm run dev` work fully offline.

### 2.3 Verifying without a network

```powershell
npm run typecheck   # tsc --noEmit, the project's gate
npm run lint        # eslint
```

`npm run build` also works offline **provided** the font cache exists (see §3.1).

### 2.4 Wrong Node version

Next.js 16 needs a modern Node (18.18+/20+). Check:

```powershell
node -v
npm -v
```

---

## 3. Frontend (Next.js) errors

### 3.1 `next/font/google` cannot fetch fonts — **the classic offline failure**

`app/layout.tsx` loads `Geist`, `JetBrains_Mono` and `Merriweather` from Google Fonts. Next.js
downloads these at build time. Offline you may see something like:

```
Failed to fetch `Geist` from Google Fonts.
Error: <https://fonts.googleapis.com/...> request failed
```

Fixes, best first:

1. **Keep the `.next` cache.** If you built once while online, fonts are cached and dev/build
   work offline. Don't delete `.next`.
2. **Switch to local fonts** (permanent offline fix): download the font files once, place them in
   `app/fonts/`, and use `next/font/local` instead of `next/font/google`.
3. **Use system fonts** as a stopgap: comment out the `next/font/google` imports and set
   `font-sans`/`font-mono` to system stacks in `globals.css`.

### 3.2 `Cannot read properties of undefined (reading 'toLowerCase')` — `components/theme-provider.tsx`

The theme hotkey reads `event.key.toLowerCase()`. In rare cases a `keydown` reaches the listener
with `event.key` undefined, throwing a runtime `TypeError` (the dev overlay points at
`theme-provider.tsx (…:…) @ onKeyDown`).

Fix — guard the key:

```tsx
if (event.key?.toLowerCase() !== "d") {
  return
}
```

`npm run typecheck` will not catch this (it's valid TypeScript); it's a runtime error.

### 3.3 Hydration mismatch / `Text content did not match`

Usually caused by rendering time/theme-dependent values on the server. The root `<html>` already
has `suppressHydrationWarning` for the theme. If it appears elsewhere, make sure you don't read
`Date.now()`, `Math.random()`, `window`, or `localStorage` during render — do it in `useEffect`.

### 3.4 Route handler `params` is a Promise

In this Next.js version, dynamic API route params must be awaited:

```ts
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;   // must await
}
```

Forgetting `await` gives a `TypeError` about reading `join`/`0` of undefined, or a 500.

### 3.5 `404 Not Found` on every `/api/...` call — double prefix bug

Feature services must pass paths **without** `/api` and **without** `/api/v1`, because
`bffRequest` adds `/api` and the server client adds `/api/v1`.

```ts
// correct
getList<Patient>("/patients")
bffRequest("/recycle-bin/patient/3/restore", { method: "POST" })

// wrong → requests /api/api/v1/patients → 404
getList<Patient>("/api/v1/patients")
```

### 3.6 `503` with `{"error":{"code":"SERVICE_UNAVAILABLE",...}}`

The BFF handler could not reach Flask. Start the API (§4) and verify `FLASK_API_BASE_URL`.

### 3.7 `401 SESSION_EXPIRED` immediately after login, or a redirect loop

- The API and frontend clock differ too much (JWT expiry). Fix your system clock.
- The refresh token is stale/invalid (e.g. API DB reseeded, or `JWT_SECRET_KEY` changed). Log out,
  clear the `emr_session` cookie, log in again.
- `SESSION_SECRET` changed between runs → old cookies can't be decrypted. Clear the cookie.

### 3.8 `403 Forbidden` / access-denied screens

The role genuinely lacks the permission. This is expected behaviour, not a bug: the UI mirrors
permissions for convenience, but Flask is authoritative. Log in as a role that has the permission
(e.g. `admin` for the recycle bin / audit logs / users).

### 3.9 Port already in use

```powershell
# frontend
next dev -p 3001
# or find and stop the process on 3000
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
```

If you change the frontend port, update `CORS_ORIGINS` in the API `.env` too (same-origin BFF
means CORS rarely matters, but keep them consistent).

---

## 4. Backend (Flask) errors

### 4.1 `flask` not recognized

Use the module form with the venv interpreter:

```powershell
.\.venv\Scripts\python.exe -m flask run
.\.venv\Scripts\python.exe -m flask db upgrade
.\.venv\Scripts\python.exe -m flask seed-demo
```

### 4.2 `psycopg2.OperationalError: connection refused` / `could not connect to server`

PostgreSQL is not running.

```powershell
Get-Service postgresql*           # see if it exists
Start-Service postgresql-x64-18   # adjust the version
# or, with Docker:
docker compose up -d db
```

### 4.3 `database "emr_dev" does not exist` (or `emr_test`)

Create them (needs the postgres superuser password):

```powershell
psql -U postgres -h 127.0.0.1 -c "CREATE ROLE emr LOGIN PASSWORD 'emr';"
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE emr_dev OWNER emr;"
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE emr_test OWNER emr;"
```

### 4.4 `password authentication failed for user "emr"`

The `DATABASE_URL` / `TEST_DATABASE_URL` credentials don't match the database role. Align them in
`.env`.

### 4.5 Login always fails after a fresh start (`Invalid credentials`)

Demo users may not exist yet. Seed them:

```powershell
.\.venv\Scripts\python.exe -m flask seed-demo
```

Demo users (password `Demo@12345`): `admin`, `registrar`, `nurse`, `doctor`, `surgeon`,
`surgeon2`.

### 4.6 `sqlalchemy.exc.ProgrammingError: relation ... does not exist`

Migrations haven't been applied:

```powershell
.\.venv\Scripts\python.exe -m flask db upgrade
```

(Note: pytest does **not** need migrations — it uses `db.create_all()`.)

### 4.7 Python dependency build errors

`pydantic-core` / `psycopg2-binary` failing to build usually means the wrong Python version. Use
**Python 3.12**. With `node_modules`-equivalent already installed, you shouldn't need to reinstall
offline at all.

### 4.8 Running the test suite

See `TESTING.md` and `RUN_TESTS.md`. Short version, from `emr-api\emr-api`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

If Postgres isn't running, every test errors with a connection failure. If the repo root is wrong,
you get `ModuleNotFoundError: No module named 'app'`.

---

## 5. Errors that look like bugs but are business rules (`422` / `409`)

These are enforced by Flask. The UI mirrors them, but if you bypass the UI you'll hit them.

| Response | Meaning |
| --- | --- |
| `422` on delete/cancel/discharge | A `reason` of **at least 5 characters** is required in the JSON body. |
| `422` closing an encounter | An encounter needs **at least one diagnosis** before it can close. |
| `422` adding a diagnosis | Only **one `PRIMARY`** diagnosis per encounter. |
| `422` creating a follow-up | The scheduled time must be in the **future**. |
| `422` discharge | Body must be `{ condition_at_discharge, summary (≥10 chars), instructions? }`. |
| `422 PARENT_STILL_DELETED` on restore | You tried to restore a diagnosis whose parent encounter is still deleted — restore the encounter first. |
| `422` on `GET /recycle-bin?entity_type=…` | Unknown `entity_type` in the **query string**. Valid: `patient`, `encounter`, `diagnosis`, `user`. |
| `404` on restore | Unknown entity type in the **path**. Check the URL segment. |
| `404` on a record you just created | It was soft-deleted, or you're looking at the wrong patient/encounter id. |

`409 Conflict` generally means a state transition isn't allowed (e.g. completing a cancelled
surgery).

---

## 6. TypeScript gotchas (compile errors)

| Error | Meaning | Fix |
| --- | --- | --- |
| `TS18049: 'x' is possibly 'null'` inside an async closure | The null guard didn't narrow inside the later callback. | Use the route param id for navigation inside the closure, not the fetched object. |
| Passing `onConfirm={() => mutate()}` where `() => void \| Promise<void>` is expected | Return type mismatch. | Wrap: `onConfirm={async () => { await mutate(); }}`. |
| `Type 'X' is not assignable to type 'Permission'` | You used a raw string instead of `PERMISSIONS.*`. | Use the constant from `lib/permissions.ts`. |
| `Object is possibly 'undefined'` on `event.key` | DOM typing edge case. | Use optional chaining: `event.key?.toLowerCase()`. |

Always gate changes with:

```powershell
npm run typecheck
```

---

## 7. Git / Windows annoyances (not real errors)

- **`warning: LF will be replaced by CRLF`** — harmless line-ending notice.
- **PowerShell shows red text for `git push` even when it succeeded** — git writes progress to
  stderr. Look for `abc1234..def5678  main -> main`; that means it worked.
- **`Removing the AGENTS.md block only re-creates it`** — `next dev` rewrites the
  `nextjs-agent-rules` block in `AGENTS.md`. Commit it with your work to keep the tree clean.

---

## 8. Ports and URLs quick reference

| Service | Default URL | Set by |
| --- | --- | --- |
| Next.js frontend | `http://localhost:3000` | `next dev` |
| Flask API | `http://localhost:5000` | `flask run` |
| API base path | `/api/v1` | `API_BASE_PATH` |
| BFF base (browser) | `/api` | `bff-client.ts` baseURL |
| Health check | `http://localhost:5000/api/v1/health` | — |
| PostgreSQL | `localhost:5432` | `DATABASE_URL` / `TEST_DATABASE_URL` |

---

## 9. When you're stuck

1. Run `npm run typecheck` in the frontend and `pytest -q` in the API — these catch most
   regressions offline.
2. Check the terminal where `flask run` and `next dev` are running; the real error is usually
   printed there, not just in the browser overlay.
3. Confirm the start order: **Postgres → Flask → Next**.
4. `curl http://localhost:5000/api/v1/health` — if this fails, the problem is the API, not the UI.
5. For API contract details, every endpoint is documented in `emr-api\README.md`; the frontend
   reference is `docs/CODE_BIBLE.md`.
