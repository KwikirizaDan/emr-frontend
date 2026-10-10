# EMR Frontend

A Next.js 16 / React 19 web client for the **GSI EMR / Hospital Management System**.
It drives one complete clinical journey — registration, consultation, admission,
surgery, discharge and follow-up — against a Flask JSON API, and adds the
administration surfaces (users, wards, audit trail, recycle bin, worklists,
dashboard).

All data used in development and demos is fictional. The counterpart API lives in
the sibling repository [`emr-api`](https://github.com/KwikirizaDan/emr-api).

> New to the codebase? Read this file, then
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (the layer-by-layer reference),
> then [`docs/INTERVIEW_GUIDE.md`](docs/INTERVIEW_GUIDE.md) (the demo and defence
> playbook).

---

## Stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, server components) |
| UI | React 19, Tailwind CSS 4, shadcn/ui primitives, lucide-react icons |
| Data fetching | SWR (caching, revalidation) over a same-origin BFF |
| Forms | React Hook Form + zod resolvers |
| Tables | A thin server-paginated `DataTable` (TanStack Table available) |
| HTTP | axios, two instances (browser BFF + server Flask) |
| Language | TypeScript (strict) |
| Notifications | sonner (toasts) |
| Runtime API | Flask + PostgreSQL (`emr-api`) |

---

## Quick start

**Prerequisites**

- Node.js 20+ and npm
- A running `emr-api` (defaults to `http://localhost:5000`)

```bash
cp .env.example .env.local     # then set the two values below
npm install
npm run dev                    # http://localhost:3000
```

Sign in with any demo user from the API (`admin`, `registrar`, `nurse`, `doctor`,
`surgeon`, `surgeon2`; password `Demo@12345` unless overridden by `DEMO_PASSWORD`).

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `FLASK_API_BASE_URL` | yes | Base URL of the Flask API, e.g. `http://localhost:5000`. **Server-side only.** |
| `SESSION_SECRET` | prod | Secret used to derive the AES-256-GCM key that encrypts the session cookie. Generate with `openssl rand -base64 32`. A development fallback exists so the app boots without it. |
| `NEXT_PUBLIC_APP_NAME` | no | Optional browser-visible display name. |

> Do **not** prefix `FLASK_API_BASE_URL` or `SESSION_SECRET` with `NEXT_PUBLIC_`;
> that would inline secrets into the browser bundle. Both are read through
> `lib/env.ts`, which is marked `import "server-only"`.

---

## Architecture

The browser **never** talks to Flask directly. Every call goes to a same-origin
Next.js Route Handler (`/api/...`) that holds the credentials and proxies to Flask.
This keeps the API base URL, the access token and the refresh token on the server.

```
┌──────────────── Browser (React) ────────────────┐
│ feature component → SWR hook → feature service   │
│        → bffRequest()  (axios, baseURL "/api")   │
└──────────────────────────┬───────────────────────┘
                           │ same-origin, cookies
┌──────────────────────────▼───────────────────────┐
│ Next.js Route Handler  app/api/[...path]/route.ts │
│   • decrypts the session cookie                   │
│   • attaches the access token                     │
│   • on 401: refresh once, rewrite cookie, replay  │
│        → flaskProxy()  (axios → Flask /api/v1)    │
└──────────────────────────┬───────────────────────┘
                           │
               ┌───────────▼───────────┐
               │  Flask  emr-api        │
               │  /api/v1/*             │
               └────────────────────────┘
```

Two axios instances with distinct jobs:

- `services/http/bff-client.ts` — **browser**, `baseURL: "/api"`.
- `services/http/api-client.ts` — **server only** (`import "server-only"`),
  `baseURL: ${FLASK_API_BASE_URL}/api/v1`.

### Request lifecycle (example: a patient list)

1. `patients-table.tsx` debounces search and calls `usePatients({ q, page })`.
2. `use-patients.ts` builds a stable SWR key: `/patients?q=...&page=1&per_page=20`.
3. `patientService.list(...)` → `getList<Patient>("/patients", query)`.
4. `bffRequest("/patients", ...)` → `GET /api/patients?...` with cookies.
5. `app/api/[...path]/route.ts` decrypts the session and calls
   `flaskProxy("/patients", { accessToken })`.
6. `api-client.ts` → `GET ${FLASK_API_BASE_URL}/api/v1/patients?...` with
   `Authorization: Bearer <token>`.
7. Flask returns `{ data, meta }`; `DataTable` renders rows and derives pagination
   from `meta` (never from `rows.length`).

A `401` from Flask triggers **at most one** refresh-and-replay. `403`/`409`/`422`
are normalised into an `ApiError` and surfaced to the user.

---

## Project structure

```
app/
  (app)/            authenticated shell: dashboard, patients, encounters,
                    admissions, wards, surgeries, follow-ups, users,
                    audit-logs, recycle-bin, worklists/*
  (public)/         login, unauthorized
  api/
    auth/           login | logout | refresh | me  (BFF auth boundary)
    [...path]/      catch-all BFF proxy to Flask
  layout.tsx, page.tsx, not-found.tsx
components/
  app-shell/        sidebar, header, breadcrumbs, nav model
  shared/           DataTable inputs: FormField, PatientPicker, ConfirmDialog,
                    EmptyState/ErrorState/LoadingState, PageHeader, StatusBadge…
  data-table/       server-paginated table
  ui/               shadcn primitives (generated — not hand-edited)
  theme-provider, providers
features/<domain>/  schemas/ (zod) · hooks/ (SWR) · components/ (table, form, detail)
services/
  http/             bff-client, api-client, endpoints, api-error, api-types, list-helpers
  <domain>/         one method per endpoint (patients, encounters, admissions,
                    surgeries, followups, users, audit, worklists, recycle-bin)
lib/                env, auth/session, permissions, date/format helpers, utils
proxy.ts            cookie-presence redirect gate (not a security boundary)
docs/               ARCHITECTURE, CODE_BIBLE, INTERVIEW_GUIDE, OFFLINE_TROUBLESHOOTING
```

The unit of work is the **feature module**: `service → schema → hook →
components → pages`. Patients is the reference implementation; every other module
follows the same shape (see `docs/ARCHITECTURE.md` §5 and §8).

---

## Authentication & session

- `POST /api/auth/login` verifies credentials against Flask, stores the tokens in
  an **encrypted, `httpOnly`** session cookie, and returns the safe user.
- The access token is applied server-side per request; the browser never holds it.
- `POST /api/auth/refresh` rotates the refresh token; `POST /api/auth/logout`
  revokes it and clears the cookie.
- `proxy.ts` redirects page navigations to `/login` when the cookie is absent —
  a convenience gate only. Authorization is always enforced by Flask.

## Permissions

`lib/permissions.ts` mirrors the backend role matrix **so the UI can hide controls
before a pointless request**. It is not a security boundary: Flask authorises every
call, and the client must honour a `403` by showing an access-denied state rather
than retrying.

```tsx
const canCreate = can({ role: user?.role }, PERMISSIONS.patientCreate);
```

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on `http://localhost:3000` |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` — the primary quality gate |
| `npm run lint` | ESLint (eslint-config-next) |
| `npm run format` | Prettier (with the Tailwind class sorter) |

## Testing & quality

The frontend currently relies on **compile-time and static checks**:
`npm run typecheck`, `npm run lint`, and a production build. The backend owns the
critical-logic and permission tests (`pytest` in `emr-api`, including a suite that
calls every restricted endpoint with the wrong role).

Planned frontend coverage (not yet built): Testing Library for the forms, guards
and `ApiError` handling, and a Playwright journey that exercises the six clinical
stages end to end.

## Conventions

- TypeScript/TSX everywhere; no untyped boundaries against the API.
- Style with **shadcn design tokens** (`bg-card`, `text-muted-foreground`,
  `text-destructive`) — never raw hex, so light/dark stay in parity.
- **Icons, not emoji** (lucide-react), and status is never colour-only.
- Client validation is a mirror; the server always re-validates.
- Deleting is a soft delete with a required, audited reason (≥ 5 characters).
- `server-only` guards every module that may read a secret.

---

## Known limitations

- **No frontend test suite yet** (see *Testing & quality*).
- One role per user and a single facility; no multi-tenant scoping.
- Closed encounters are read-only; there is no addendum workflow.
- No offline mode or service worker — the app requires the local API (see
  `docs/OFFLINE_TROUBLESHOOTING.md`).
- `components/ui/**` is generated by shadcn and is intentionally left as-is.

For production, terminate TLS at a reverse proxy, keep `SESSION_SECRET` in a secret
manager, run the API behind gunicorn/nginx, and follow the hardening list in the
`emr-api` README (§17).

---

## Documentation

| File | Contents |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layer reference, request lifecycle, worked Patients example, project Q&A |
| [`docs/CODE_BIBLE.md`](docs/CODE_BIBLE.md) | Code-level reference and rationale |
| [`docs/INTERVIEW_GUIDE.md`](docs/INTERVIEW_GUIDE.md) | GSI demo script, live-change method, demo Q&A, ops answers |
| [`docs/OFFLINE_TROUBLESHOOTING.md`](docs/OFFLINE_TROUBLESHOOTING.md) | Common runtime errors and fixes |

---

## Disclosure of AI assistance

This client was built with **AI assistance** from requirements specified by the
author; no downloaded EMR or template application was used beyond the shadcn/ui
component registry. Libraries are listed under **Stack** above. Written, changed,
debugged and verified by the author: _(list what you personally wrote, changed or
debugged)_.

The author has read and run the code and can explain every part.
