# The EMR Frontend Code Bible

A complete, section-by-section walkthrough of this codebase: what every folder is for, how a
request travels from a click to PostgreSQL and back, why each decision was made, and where the
edges are. Read it top to bottom once, then use the table of contents as a reference.

> Companion docs: `docs/ARCHITECTURE.md` (shorter narrative + project Q&A) and the Flask
> `emr-api/README.md` (authoritative API contract). This file is the deep, code-level reference.

---

## Table of contents

1. [The 60-second mental model](#1-the-60-second-mental-model)
2. [Stack and versions](#2-stack-and-versions)
3. [Repository map](#3-repository-map)
4. [An end-to-end request, step by step](#4-an-end-to-end-request-step-by-step)
5. [Configuration and environment](#5-configuration-and-environment)
6. [The HTTP layer](#6-the-http-layer)
7. [Authentication and the session](#7-authentication-and-the-session)
8. [Permissions and the role model](#8-permissions-and-the-role-model)
9. [The feature-module anatomy](#9-the-feature-module-anatomy)
10. [Worked example: Patients, file by file](#10-worked-example-patients-file-by-file)
11. [The App Router page tree](#11-the-app-router-page-tree)
12. [The shared UI kit](#12-the-shared-ui-kit)
13. [Formatting and date helpers](#13-formatting-and-date-helpers)
14. [Feature modules at a glance](#14-feature-modules-at-a-glance)
15. [Deep dive: the recycle bin (frontend + backend)](#15-deep-dive-the-recycle-bin-frontend--backend)
16. [The Flask API contract this UI is built on](#16-the-flask-api-contract-this-ui-is-built-on)
17. [Design decisions and why](#17-design-decisions-and-why)
18. [Limitations and trade-offs](#18-limitations-and-trade-offs)
19. [Extension guide: add a new module](#19-extension-guide-add-a-new-module)
20. [Conventions, gotchas and review checklist](#20-conventions-gotchas-and-review-checklist)
21. [Interview Q&A quick answers](#21-interview-qa-quick-answers)

---

## 1. The 60-second mental model

This is a **Next.js App Router frontend for an existing Flask JSON API**. It is deliberately *not*
a thin client and *not* a second backend.

- The browser **never** holds a token and **never** talks to Flask directly. It calls
  same-origin `/api/...` endpoints.
- A catch-all **BFF route handler** (`app/api/[...path]/route.ts`) reads an encrypted `httpOnly`
  cookie, attaches the access token to the request, calls Flask, and pipes the response back.
  If Flask says `401`, it refreshes once and retries exactly once.
- **Feature services** (`services/<feature>/*-service.ts`) are the only code that names an
  endpoint, and they are client-safe: they call the BFF through `bffRequest`.
- **SWR hooks** wrap services to give caching, retry and revalidation.
- **Server Components** render static shells; **Client Components** own forms, tables, filters
  and dialogs.
- Every feature follows the same five-part shape:
  `service → schema → hook → components → page`.

That single sentence — *browser → same-origin BFF → Flask, token never leaves the server* — is the
spine of the whole codebase. Everything else is convention layered on top.

---

## 2. Stack and versions

From `package.json`:

| Concern | Choice | Version |
| --- | --- | --- |
| Framework | Next.js (App Router) | `16.4.0` |
| UI runtime | React / React DOM | `19.3.0` |
| Language | TypeScript (strict) | via `tsc --noEmit` |
| HTTP (client + server) | axios | `^1.20.0` |
| Data fetching / cache | SWR | `^2.5.1` |
| Forms | react-hook-form + `@hookform/resolvers` | `^7.89`, `^5.9` |
| Validation | zod | `^3.25` |
| Headless primitives | `@base-ui/react` | `^1.9` |
| Components / tokens | shadcn (`shadcn` CLI, Tailwind v4) | `^4.21` |
| Tables | `@tanstack/react-table` | `^9.2` |
| Icons | `lucide-react` (primary), `@remixicon/react` | `^1.55`, `^4.9` |
| Toasts | sonner | `^2.0` |
| Dates | date-fns + `Intl` | `^4.4` |
| Theming | next-themes | `^0.4` |
| CSS | Tailwind v4 (`@tailwindcss/postcss`), `tw-animate-css` | — |

Scripts:

```jsonc
"dev":       "next dev",
"build":     "next build",
"start":     "next start",
"lint":      "eslint",
"format":    "prettier --write \"**/*.{ts,tsx}\"",
"typecheck": "tsc --noEmit"
```

> **Note for reviewers:** this repo targets a Next.js version whose APIs differ from older
> releases (see `AGENTS.md` and `node_modules/next/dist/docs/`). Notably, request middleware is
> `proxy.ts` (not `middleware.ts`), and route-handler `params` are a **Promise** that must be
> awaited. Heed deprecation notices from the bundled docs, not memory.

Dependency discipline: only `axios` was added beyond the starting template. No state library
(Redux, Zustand, React Query) — SWR plus URL/search state is enough for this surface area.

---

## 3. Repository map

```
emr-frontend/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root: fonts, ThemeProvider, Providers (SWR + toaster)
│   ├── page.tsx              # "/" → redirect("/dashboard")
│   ├── not-found.tsx
│   ├── globals.css           # Tailwind v4 + shadcn design tokens
│   ├── (public)/             # Unauthenticated routes
│   │   ├── login/page.tsx
│   │   └── unauthorized/page.tsx
│   ├── (app)/                # Authenticated routes (share AppShell)
│   │   ├── layout.tsx        # Renders <AppShell>
│   │   ├── dashboard/page.tsx
│   │   ├── patients/…        # list, new, [patientId], edit, timeline, encounters/new
│   │   ├── encounters/…      # list, new, [encounterId]
│   │   ├── admissions/…      # list, new, [admissionId]
│   │   ├── surgeries/…       # list, new, [surgeryId]
│   │   ├── follow-ups/…      # list, new, [followUpId]
│   │   ├── wards/page.tsx
│   │   ├── users/…           # list, new, [userId]/edit
│   │   ├── audit-logs/page.tsx
│   │   ├── worklists/…       # inpatients, surgeries, follow-ups
│   │   └── recycle-bin/page.tsx
│   └── api/                  # Same-origin BFF (server only)
│       ├── [...path]/route.ts    # Proxy every non-auth call to Flask
│       └── auth/{login,refresh,logout,me}/route.ts
├── components/
│   ├── ui/                   # shadcn primitives (button, dialog, table, …)
│   ├── shared/               # App-level building blocks (see §12)
│   ├── data-table/           # DataTable<T> wrapper over tanstack table
│   ├── app-shell/            # Sidebar, header, breadcrumbs, nav-items
│   ├── providers.tsx         # SWRConfig + TooltipProvider + Toaster
│   └── theme-provider.tsx
├── features/                 # One folder per domain area
│   └── <feature>/
│       ├── schemas/          # zod schemas + payload mappers
│       ├── hooks/            # SWR wrappers
│       └── components/       # tables, forms, detail views
├── services/                 # Client-safe API services + server-only clients
│   ├── http/                 # api-types, api-error, endpoints, api-client, bff-client, list-helpers
│   ├── auth/                 # server-only auth-service
│   └── <feature>/            # <feature>-service.ts
├── lib/
│   ├── auth/                 # session.ts (crypto), server-session.ts
│   ├── date.ts, formatters.ts, permissions.ts, utils.ts, env.ts
├── proxy.ts                  # Cookie-presence gate for page routes
├── docs/                     # ARCHITECTURE.md, CODE_BIBLE.md
└── .env.example              # tracked; real .env* files are ignored
```

The directory split encodes the trust boundary:

- `services/http/api-client.ts`, `services/auth/auth-service.ts`, `lib/auth/*`, `lib/env.ts` all
  begin with `import "server-only"` — importing them in a Client Component is a **build error**.
- `services/http/bff-client.ts`, `services/http/list-helpers.ts`, `services/<feature>/*` and
  everything under `features/` and `components/` are client-safe.

---

## 4. An end-to-end request, step by step

Take "registrar opens the patient list".

```
Browser (Client Component)
  │  usePatients({ q, page })
  ▼
SWR  ──►  patientService.list(filters)
  │            └─ getList("/patients", { q, page, per_page })   // services/http/list-helpers.ts
  ▼
bffRequest("/patients", { query })                              // services/http/bff-client.ts
  │   axios baseURL "/api"  →  GET /api/patients?q=…&page=…&per_page=…
  ▼
Next.js Route Handler  app/api/[...path]/route.ts
  │   1. path[0] === "auth"?  → 404 (auth has its own handlers)
  │   2. resolveSession()  — decrypt the emr_session cookie
  │        not authenticated  → clear cookie, 401 SESSION_EXPIRED
  │   3. encodeQuery + read body once (ArrayBuffer) for replay
  │   4. flaskProxy("/patients", { accessToken, query, body })
  ▼
services/http/api-client.ts → flaskProxy → axios → Flask  GET /api/v1/patients?…
  │   (server attaches Authorization: Bearer <access_token>)
  ▲   Flask returns { data: [...], meta: {...} }
  │   5. if status === 401 → authService.refresh(session) once,
  │        write new cookie, replay the exact same bytes once
  ▼
Response piped back to the browser unchanged
  ▼
getList unwraps { data, meta }  →  { data: rows, meta }
  ▼
usePatients returns { rows, meta, isLoading, error, mutate }
  ▼
DataTable renders rows; EmptyState / ErrorState handle the other two states
```

Two properties fall out of this shape:

1. **The token literally cannot leak to client JS** — it never appears in a response body, only
   inside the sealed cookie.
2. **A single place enforces "refresh at most once"** — the retry loop lives only in the route
   handler, not scattered across services.

---

## 5. Configuration and environment

`lib/env.ts` (server-only) is the single reader of process config:

```ts
import "server-only";

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export const env = {
  get flaskApiBaseUrl(): string {
    const value = read("FLASK_API_BASE_URL");
    if (!value) throw new Error("FLASK_API_BASE_URL is not configured. …");
    return value.replace(/\/+$/, "");          // strip trailing slashes
  },
  get sessionSecret(): string {
    const value =
      read("SESSION_SECRET") ??
      (process.env.NODE_ENV === "development"
        ? "emr-development-session-secret"
        : undefined);
    if (!value) throw new Error("SESSION_SECRET must be set outside development.");
    return value;
  },
};
```

Environment variables:

| Name | Scope | Purpose |
| --- | --- | --- |
| `FLASK_API_BASE_URL` | server only | Base URL of the Flask API, e.g. `http://localhost:5000` |
| `SESSION_SECRET` | server only | Derives the AES-256-GCM key for the session cookie |

Rules:

- **Never** prefix these with `NEXT_PUBLIC_` — that inlines them into the browser bundle.
- `.env*` is git-ignored; `.env.example` is tracked as the template.
- `env` is accessed lazily via getters so a production build can boot without the values set
  until a request actually needs them.

---

## 6. The HTTP layer

This is the most important folder in the repo. Five small files divide the work.

### 6.1 `services/http/api-types.ts` — the contract

Neutral shapes (no `server-only`, so both server and client can import them). Field names match
the Flask `to_dict()` output exactly — snake_case, not camelCase.

```ts
export type PaginationMeta = { page: number; per_page: number; total: number; pages: number };
export type ApiEnvelope<T>  = { data: T; meta?: PaginationMeta };
export type Paginated<T>    = { data: T[]; meta: PaginationMeta };

export type Patient = {
  id: number; mrn: string; first_name: string; last_name: string;
  sex: "MALE" | "FEMALE" | "OTHER"; date_of_birth: string;
  national_id: string | null; phone: string | null; /* … */
  version: number;
};
```

It also carries `Encounter`, `Diagnosis`, `Ward`, `Bed`, `Admission`, `Discharge`, `Surgery`,
`FollowUp`, `User`, `AuditLog`, the worklist item types, `DashboardData`, and the recycle-bin
types. `ApiErrorEnvelope` documents the error shape:

```ts
export type ApiErrorEnvelope = {
  error: { code: string; message: string; details?: Record<string, unknown>; request_id?: string };
};
```

### 6.2 `services/http/api-error.ts` — one error type to rule them all

`ApiError extends Error` with `status`, `code`, `details`, `requestId` and convenience getters
(`isAuthError`, `isForbidden`, `isConflict`, …). `parseErrorEnvelope(status, body, requestId)`
turns any unknown payload into a safe `ApiError`, and `messageForStatus` supplies sensible
fallbacks when Flask has nothing useful to say.

Why it matters: components never branch on raw status codes. They catch `ApiError`, read
`error.displayMessage`/`error.requestId`, and show a consistent message. Stack traces and internal
detail are never rendered.

### 6.3 `services/http/endpoints.ts` — the only place URLs are written

```ts
export const API_BASE_PATH = "/api/v1";

export const ENDPOINTS = {
  health: "/health",
  auth: { login: "/auth/login", refresh: "/auth/refresh", logout: "/auth/logout", me: "/auth/me" },
  dashboard: "/dashboard",
  patients: "/patients",
  patient: (id: string | number) => `/patients/${id}`,
  patientTimeline: (id: string | number) => `/patients/${id}/timeline`,
  // …encounters, diagnoses, close, wards, admissions, discharge, surgeries,
  // users, reset-password, follow-ups, worklists, audit logs
};
```

The file's doc comment is explicit: *this map records the documented contract; it does not replace
reading the backend source.* Every path must be checked against Flask before a feature is wired.

### 6.4 `services/http/api-client.ts` — server only

`import "server-only"`. A lazily created axios instance rooted at
`${FLASK_API_BASE_URL}/api/v1`, with `validateStatus: () => true` so non-2xx responses are values,
not exceptions.

Three exports:

- `flaskRequest<T>(path, options)` → `{ status, ok, data, requestId }`. Used by the auth service
  where a `401` must be *inspected* rather than thrown.
- `apiRequest<T>(path, options)` → throws `parseErrorEnvelope(...)` on non-2xx, returns `data`.
- `flaskProxy(path, init)` → forwards a raw browser request to Flask and returns a real `Response`,
  copying `content-type` and `x-request-id`. This is what the BFF handler uses.

```ts
export async function flaskProxy(path, init): Promise<Response> {
  try {
    const response = await flaskApi().request<string>({
      url: path, method: init.method,
      data: init.body ? Buffer.from(init.body) : undefined,
      params: toParams(init.query),
      headers: {
        Authorization: `Bearer ${init.accessToken}`,
        ...(init.contentType ? { "Content-Type": init.contentType } : {}),
      },
      responseType: "text",
      transformResponse: [(data) => data],   // never parse/validate here
    });
    // …copy content-type + x-request-id headers…
    return new Response(response.data ?? "", { status: response.status, headers });
  } catch {
    return Response.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Unable to reach the EMR service. …" } },
      { status: 503 },
    );
  }
}
```

`responseType: "text"` + a no-op transform means the server forwards Flask's body verbatim
without re-serialising it.

### 6.5 `services/http/bff-client.ts` — browser side

The **only** axios instance the browser sees. `baseURL: "/api"`, `withCredentials: true` (so the
session cookie is sent), and it normalises errors into `ApiError`:

```ts
const bffApi = axios.create({
  baseURL: "/api",
  headers: { Accept: "application/json" },
  withCredentials: true,
});

export async function bffRequest<T>(path, options = {}): Promise<T> {
  try {
    const response = await bffApi.request<T>({
      url: path.startsWith("/") ? path : `/${path}`,
      method: options.method ?? "GET",
      data: options.body ?? undefined,
      params: normalizeParams(options.query),
      signal: options.signal,
    });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error) || error instanceof ApiError) throw error;
    // …response present → parseErrorEnvelope(status, data, x-request-id)
    // …response absent  → ApiError({ status: 0, "Unable to reach the EMR service…" })
  }
}
```

**Critical rule for the whole codebase:** `bffRequest` copies the path onto `/api`, so a service
must pass the path **without** the `/api` or `/api/v1` prefix — e.g. `getList("/patients")`,
`bffRequest("/recycle-bin/patient/3/restore", { method: "POST" })`. Getting this wrong produces
`/api/api/v1/...` and a 404.

### 6.6 `services/http/list-helpers.ts` — list/detail sugar

```ts
export async function getList<T>(path, query = {}): Promise<Paginated<T>> {
  const response = await bffRequest<{ data?: T[]; meta?: PaginationMeta }>(path, {
    query: listQuery(query),
  });
  return {
    data: Array.isArray(response?.data) ? response.data : [],
    meta: response?.meta ?? { page: 1, per_page: 20, total: 0, pages: 0 },
  };
}

export async function getOne<T>(path): Promise<T | null> {
  const response = await bffRequest<{ data?: T | null }>(path);
  return response?.data ?? null;
}
```

`listQuery` strips empty values and stringifies `page`/`per_page`. Defensive defaults mean a
missing `data` array can never crash a table.

---

## 7. Authentication and the session

### 7.1 `lib/auth/session.ts` — the crypto (server only)

A self-contained AES-256-GCM implementation. No session store: the cookie *is* the store, so it
works across instances without shared memory.

- **Key derivation:** `scryptSync(SESSION_SECRET, randomSalt, 32)`; the per-cookie salt is stored
  alongside the ciphertext.
- **Format:** `v1.<base64url(salt|iv|tag|ciphertext)>`, with a `v1` version prefix for rotation.
- **Payload:** `{ accessToken, refreshToken, accessTokenExpiresAt?, refreshTokenExpiresAt?, user }`
  where `user` is a `SessionUser` (`id, username, fullName, email, role`).
- Helpers: `encryptSession`, `decryptSession` (returns `null` on any tamper/parse failure),
  `isAccessTokenExpired`, `isRefreshTokenExpired`, `sessionCookieOptions(payload)`.

`sessionCookieOptions` computes `maxAge` from the refresh token's remaining life (default 7 days,
floored at 60 s) and sets `httpOnly`, `sameSite: "lax"`, `secure` in production, `path: "/"`.

### 7.2 `lib/auth/server-session.ts` — Next.js glue

```ts
export async function readSessionCookie(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decryptSession(store.get(SESSION_COOKIE_NAME)?.value);
}
export async function writeSessionCookie(session: SessionPayload) { /* set encrypted */ }
export async function clearSessionCookie() { /* delete */ }
export async function resolveSession(): Promise<Resolved> { /* read + expiry check */ }
```

`resolveSession()` returns either `{ status: "authenticated", session }` or an unauthenticated
status the route handler maps to `401 SESSION_EXPIRED`.

### 7.3 `services/auth/auth-service.ts` — talking to Flask auth

Server-only. `login(input)` calls `POST /auth/login`, normalises the response (accepting both
snake_case and camelCase user keys so a backend rename won't break it), builds a `SessionPayload`,
and returns `{ ok, session }` or a shaped failure. `refresh(session)` calls `POST /auth/refresh`;
`logout(session)` calls `POST /auth/logout`. All use `flaskRequest` so a `401` is a value to
inspect, not a throw.

### 7.4 The auth route handlers (`app/api/auth/*`)

| Route | Behaviour |
| --- | --- |
| `POST /api/auth/login` | Validate with `loginSchema`, call `authService.login`, seal the cookie, return only the public user. |
| `POST /api/auth/refresh` | Rotate the session from the refresh token. |
| `POST /api/auth/logout` | Revoke server-side, clear the cookie. |
| `GET /api/auth/me` | Return the current `SessionUser` from the cookie. |

`login/route.ts` shows the pattern: parse `request.json()` defensively, `loginSchema.safeParse`,
return the Flask-shaped `{ error: { code, message, details } }` on invalid input, then write the
session cookie and return `{ data: { …user } }` only.

### 7.5 `app/api/[...path]/route.ts` — the catch-all proxy

This is the keystone file. It exports `GET/POST/PUT/PATCH/DELETE = handle`. The `handle` function:

1. Rejects `path[0] === "auth"` with `404` — auth lives in its own handlers with different semantics.
2. `resolveSession()`; unauthenticated → clear cookie + `401 SESSION_EXPIRED`.
3. `encodeQuery(request)` flattens repeated query params.
4. Reads the body **once** into an `ArrayBuffer` (for methods in
   `POST/PUT/PATCH/DELETE`) so a retry can replay the exact bytes.
5. Calls `flaskProxy`, and on `401` calls `authService.refresh`, writes the new cookie, and
   replays the request **exactly once**.
6. Returns Flask's response verbatim.

The retry policy is stated in the file header: *at most one refresh-then-retry per request, and
only in response to a `401` from Flask. A non-idempotent `POST` is never retried after an
ambiguous network failure.* That last clause matters clinically — you do not want a duplicated
encounter because a request timed out ambiguously.

### 7.6 `proxy.ts` — cookie-presence gate (not security)

```ts
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/") ||
      pathname === "/login" || pathname === "/unauthorized" ||
      pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";          // (then preserves the intended destination)
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
```

In this Next.js version the request middleware file is `proxy.ts` and the exported function is
`proxy`. It only checks that *a* cookie exists — it does not verify it. The doc comment is blunt:
this is a redirect convenience, **not** a security boundary. The BFF re-validates the encrypted
session and Flask still authorises every call.

### 7.7 `useCurrentUser` + `AppShell`

`features/auth/hooks/use-current-user.ts` is a one-line SWR wrapper over `GET /auth/me` returning
`{ user, isLoading, error, mutate }`. The `AppShell` (Client Component) uses it to:

- show a `ShellSkeleton` while loading,
- `router.replace("/login")` if there is an error or no user,
- render nothing (not a flash of authorised UI) while redirecting,
- pass `user` to `AppSidebar` so nav items are filtered by role.

The hook's comment encodes the philosophy: navigation gating is *"only to hide controls the
current role cannot use. A 403 from Flask is still the final answer."*

---

## 8. Permissions and the role model

`lib/permissions.ts` is a **UI-convenience mirror** of the backend matrix. The file header warns
in capitals that Flask is the sole authority.

```ts
export const ROLES = ["ADMIN", "REGISTRAR", "NURSE", "DOCTOR", "SURGEON"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  patientView: "patient:view",
  patientCreate: "patient:create",
  patientDelete: "patient:delete",
  encounterClose: "encounter:close",
  // …see the file for the full set…
  auditView: "audit:view",
  recycleBinView: "recyclebin:read",
  recycleBinRestore: "recyclebin:restore",
} as const;
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
```

`ROLE_PERMISSIONS` maps each role to its granted set. Two things are worth calling out in review:

- `ADMIN` gets account/ward/audit/recycle-bin powers but **not** clinical record access — the
  comment says the backend is deliberately stricter than a naive "admin is god" model.
- `SURGEON` is expressed as the doctor set **plus** surgery scheduling and transitions.

```ts
export function can(subject, permission) {
  if (!subject) return false;
  // An explicit permission list from the API wins over the mirrored role map.
  if (subject.permissions?.length) return subject.permissions.includes(permission);
  return permissionsForRole(subject.role).includes(permission);
}
```

`can` accepts a `PermissionSubject` (`{ role?, permissions? }`), so if the API ever sends an
explicit permission list, that optimisation silently takes precedence. Also exported:
`canAny`, `canAll`, `hasRole`, `permissionsForRole`, `ALL_PERMISSIONS`.

Consumption pattern (in tables/forms):

```ts
const { user } = useCurrentUser();
const canDelete = can({ role: user?.role }, PERMISSIONS.patientDelete);
// …render the Delete button only when canDelete
```

And for whole views, `PermissionGate` / `AccessDenied` from `components/shared/permission-gate.tsx`.

---

## 9. The feature-module anatomy

Every domain area under `features/` follows the same five layers. Learn it once and the rest is
mechanical.

```
services/<feature>/<feature>-service.ts     ← endpoint names + payload types (client-safe)
features/<feature>/schemas/<x>-schema.ts    ← zod validation + payload mapper
features/<feature>/hooks/use-<x>.ts         ← SWR cache key + service call
features/<feature>/components/*.tsx         ← tables, forms, detail views ("use client")
app/(app)/<feature>/page.tsx (+ subroutes)  ← thin server pages: PageHeader + component
```

**Why this shape**

- **Service** is the only layer that knows a URL string; change the API path once and every
  caller follows. Services contain *no* business rules — those belong to Flask.
- **Schema** keeps form validation in one testable place and gives react-hook-form a typed
  resolver. It mirrors Flask validation for friendly feedback only.
- **Hook** owns the SWR key. The key *is* the cache identity; building it from the filter object
  means "same filters → cached result, new filters → new request".
- **Components** are client-side and own interaction (filters, dialogs, optimistic UI).
- **Page** is a Server Component with `export const metadata` and no logic — just
  `<PageHeader/>` + the feature component.

---

## 10. Worked example: Patients, file by file

### 10.1 `services/patients/patient-service.ts`

```ts
export type PatientFilters = { q?: string; page?: number; per_page?: number };

export type PatientPayload = {
  first_name: string; last_name: string; sex: "MALE" | "FEMALE" | "OTHER";
  date_of_birth: string;
  national_id?: string | null; phone?: string | null; address?: string | null;
  next_of_kin_name?: string | null; next_of_kin_phone?: string | null;
};

export const patientService = {
  list: (filters = {}) => getList<Patient>("/patients", { ...filters }),
  getById: (id) => getOne<Patient>(`/patients/${id}`),
  // create / update / remove / timeline …
};
```

Note the path needs **no** `/api` prefix (BFF adds it) and no `/v1` (the server client adds it).

### 10.2 `features/patients/schemas/patient-schema.ts`

```ts
const NAME_PATTERN  = /^[A-Za-z][A-Za-z '-]*$/;
const PHONE_PATTERN = /^\+?[0-9 ]{7,20}$/;

const optionalText = (max: number) =>
  z.string().max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : ""));

export const patientFormSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100).regex(NAME_PATTERN, "…"),
  last_name:  z.string().min(1, "Last name is required").max(100).regex(NAME_PATTERN, "…"),
  sex: z.enum(["MALE", "FEMALE", "OTHER"], { required_error: "Select the patient's sex" }),
  // …
});
export type PatientFormValues = z.infer<typeof patientFormSchema>;
export function toPatientPayload(values: PatientFormValues): PatientPayload { /* trim/blank→null */ }
```

The `.transform` turns empty strings into `""`/null so the payload matches Flask's expectations,
and `toPatientPayload` is the single mapping seam between form shape and API shape.

### 10.3 `features/patients/hooks/use-patients.ts`

```ts
function buildKey(filters: PatientFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  params.set("page", String(filters.page ?? 1));
  params.set("per_page", String(filters.per_page ?? 20));
  return `/patients?${params.toString()}`;
}

export function usePatients(filters = {}) {
  const { data, error, isLoading, isValidating, mutate } =
    useSWR(buildKey(filters), () => patientService.list(filters));
  return { rows: (data?.data ?? []) as Patient[], meta: data?.meta ?? null,
           isLoading, isValidating, error, mutate };
}
```

The key string *is* the request URL, which makes the cache auditable in devtools.

### 10.4 `features/patients/components/patients-table.tsx`

The richest example of the table pattern. It combines:

- **Debounced search** — a 300 ms `setTimeout` copies `term` into `query` and resets the page.
- **Role gating** — `can({ role: user?.role }, PERMISSIONS.patientCreate/Update/Delete)`.
- **Column definitions** — `DataTableColumn<Patient>[]` with a link on the name cell.
- **Soft-delete flow** — a `ConfirmDialog` with a required reason (min 5 chars), calling
  `patientService.remove(id, reason)` then `mutate()`.
- **Empty vs no-results copy** — different `EmptyState` text depending on `query`.

```tsx
async function confirmDelete() {
  if (!pendingDelete) return;
  if (reason.trim().length < 5) { setReasonError("Enter a reason of at least 5 characters."); return; }
  setDeleting(true); setReasonError(null);
  try {
    await patientService.remove(pendingDelete.id, reason.trim());
    toast.success("Patient record deleted", { description: "The record is kept for audit." });
    setPendingDelete(null); setReason("");
    await mutate();
  } catch (error) {
    toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
  } finally { setDeleting(false); }
}
```

### 10.5 `app/(app)/patients/page.tsx`

```tsx
import { PageHeader } from "@/components/shared/page-header";
import { PatientsTable } from "@/features/patients/components/patients-table";

export const metadata = { title: "Patients" };

export default function PatientsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Patients"
        description="Search the register by name, MRN, national ID or phone, and manage patient records." />
      <PatientsTable />
    </div>
  );
}
```

A Server Component with zero logic. The `"use client"` boundary starts at `PatientsTable`.

---

## 11. The App Router page tree

Route groups separate the two shells:

- `(public)/login`, `(public)/unauthorized` — no session required.
- `(app)/*` — wrapped by `app/(app)/layout.tsx`, which renders `<AppShell>` (sidebar + header +
  breadcrumbs). Every authenticated page lives here.

| Path | Page component | Notes |
| --- | --- | --- |
| `/` | `app/page.tsx` | `redirect("/dashboard")` |
| `/login` | `(public)/login` | Login form |
| `/dashboard` | `(app)/dashboard` | Summary metric cards |
| `/patients` | list | Register table |
| `/patients/new` | register form | |
| `/patients/[patientId]` | detail | |
| `/patients/[patientId]/edit` | edit form | |
| `/patients/[patientId]/timeline` | timeline | encounters, admissions, surgeries, follow-ups |
| `/patients/[patientId]/encounters/new` | encounter form | patient pre-selected |
| `/encounters`, `/encounters/new`, `/encounters/[encounterId]` | encounter list/new/detail | diagnoses live on detail |
| `/admissions`, `/admissions/new`, `/admissions/[admissionId]` | admissions | discharge on detail |
| `/surgeries`, `/surgeries/new`, `/surgeries/[surgeryId]` | surgeries | start/complete/cancel |
| `/follow-ups`, `/follow-ups/new`, `/follow-ups/[followUpId]` | follow-ups | status transitions |
| `/wards` | wards & beds | occupancy |
| `/users`, `/users/new`, `/users/[userId]/edit` | admin | |
| `/audit-logs` | admin | filters by entity/user/action/date |
| `/worklists/inpatients`, `/worklists/surgeries`, `/worklists/follow-ups` | worklists | |
| `/recycle-bin` | admin | soft-deleted records + restore |

Dynamic route params are read from `useParams()` in Client Components. TypeScript strictness
means: **after you guard a fetched object for `null`, use the route param id for navigation, not
the object's id** — otherwise `TS18049` ("possibly null"). The same guard the compiler accepts for
rendering does not narrow the object inside a later async closure.

---

## 12. The shared UI kit

All under `components/shared/` unless noted. These are the vocabulary of every screen.

| Component | File | Contract / purpose |
| --- | --- | --- |
| `DataTable<T>` | `components/data-table/data-table.tsx` | Columns + rows + `getRowId`, `loading`, `error`, `onRetry`, `meta`, `onPageChange`, `onPerPageChange`, `empty`. Renders skeletons, `ErrorState`, or `EmptyState` automatically. |
| `FormField` | `form-field.tsx` | Render-prop field: derives `id`, `aria-describedby`, `aria-invalid` and links label/description/error. `fieldMessage(error)` maps RHF errors. |
| `ConfirmDialog` | `confirm-dialog.tsx` | AlertDialog for destructive/irreversible actions. Optional **required** reason field (`reasonLabel`, `onReasonChange`, `reasonError`) or arbitrary `children`. `pending` shows a spinner. |
| `SelectNative` | `select-native.tsx` | Native `<select>` styled with shadcn input tokens. Chosen over the portal-based `Select` for dependable form semantics. |
| `StatusBadge` / `WorkflowStatusBadge` / `toneForStatus` | `status-badge.tsx` | Status is **never colour alone** — always icon + label. `toneForStatus` maps known statuses, unknown → neutral. |
| `PatientPicker` | `patient-picker.tsx` | Debounced server-side lookup by name/MRN/national ID/phone. Reused by encounter, admission, surgery and follow-up forms; never downloads the whole register. |
| `EmptyState` | `empty-state.tsx` | Icon + title + description + optional action. |
| `ErrorState` | `error-state.tsx` | Maps `403/404/5xx` to friendly copy, shows the `requestId` for support, optional "Try again". |
| `LoadingState` / `LoadingCards` | `loading-state.tsx` | Skeleton rows / cards with `role="status"`. |
| `PageHeader` | `page-header.tsx` | Consistent title + one-line description + primary action. |
| `PermissionGate` / `AccessDenied` | `permission-gate.tsx` | Hide or replace UI the role cannot use; `mode="any" | "all"`. |

`DataTable` is worth understanding well: feature tables do not reimplement loading/empty/error
states — they hand `DataTable` a column array and a row array, and it decides what to render.

```ts
export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
};
```

---

## 13. Formatting and date helpers

### `lib/formatters.ts`

Pure display helpers. `humanizeEnum("IN_PROGRESS") → "In progress"`,
`formatPersonName` gives clinical `Last, First`, `formatPersonDisplayName` gives `First Last`,
`formatMrn` never invents a value (`"—"` fallback), `initials`, `formatPhone`, `formatBoolean`,
`truncateMiddle`.

### `lib/date.ts`

Everything is displayed in **Africa/Kampala** via `Intl.DateTimeFormat`, while values sent to
Flask keep their original representation (the backend stores UTC).

| Function | Output |
| --- | --- |
| `formatDateTime` | `12 Oct 2026, 14:30` |
| `formatDate` | `12 Oct 2026` |
| `formatTime` | `14:30` |
| `formatDayMonth` | `12 Oct` |
| `todayKey` / `dayKey` | `YYYY-MM-DD` (used by the `day=` worklist filter) |
| `formatAge` / `ageFromDateOfBirth` | `34 yrs` (sane-bounded 0–129, else `—`) |
| `toDateTimeLocalValue` / `fromDateTimeLocalValue` | `datetime-local` input round-trips |
| `toDateInputValue` | `YYYY-MM-DD` for a `date` input |

`lib/utils.ts` is a one-liner re-export: `export { cn } from "cn";`.

---

## 14. Feature modules at a glance

| Module | Service | Key components | Notable rules enforced in UI |
| --- | --- | --- | --- |
| **Dashboard** | (dashboard endpoint via `use-dashboard`) | `dashboard-summary`, `metric-card` | Renders only keys the API returns; open `DashboardData` type. |
| **Patients** | `patient-service` | `patients-table`, `patient-form`, detail, timeline | Soft delete requires a ≥5-char reason; duplicate checks happen server-side. |
| **Encounters** | (encounter service) | encounter list/new/detail, diagnoses | Diagnoses live on the detail view; closing needs ≥1 diagnosis; only one `PRIMARY` per encounter. |
| **Wards & admissions** | (ward/admission services) | `admission-form`, `admission-detail`, `discharge-form`, `admissions-table` | Discharge body `{ condition_at_discharge, summary(≥10), instructions? }`; admissions/surgeries/discharges are never deleted, only transitioned. |
| **Surgeries** | `surgery-service` | schedule form, detail transitions | `SCHEDULED → IN_PROGRESS → COMPLETED`, or `CANCELLED` with a reason. |
| **Follow-ups** | (follow-up service) | form, detail, status transitions | Scheduled time must be in the future; status changes carry a reason. |
| **Users** | `user-service` | list, form, edit, reset-password | Admin-only; deactivated (not deleted) users are `is_active=false`. |
| **Audit logs** | (audit service) | filterable table, JSON detail dialog | Read-only; filters by entity/user/action/date. |
| **Worklists** | `worklist-service` | inpatients, surgeries (`day=YYYY-MM-DD`), follow-ups (`date_from`/`date_to`) | Three focused views over the same permission (`worklist:read`). |
| **Recycle bin** | `recycle-bin-service` | `recycle-bin-table` | Admin-only; lists and restores the four soft-deletable types. See §15. |

### Live dashboard panels

The dashboard and worklists were the last module added; they read live counts and lists rather
than hard-coded placeholders, and were wired only after every list endpoint existed. No
`RoutePlaceholder` pages remain in the app.

---

## 15. Deep dive: the recycle bin (frontend + backend)

The recycle bin is the most instructive feature because it touches *both* repos and exercises
every layer. This is the section to study before an interview.

### 15.1 The rule it implements

The API **never hard deletes**. `DELETE /patients/{id}` (and encounters, diagnoses, users) sets
`deleted_at`, `deleted_by_id`, `delete_reason`. Deleted rows vanish from lists and return `404`.
The recycle bin is the admin-only window onto those rows, with a restore button.

Four soft-deletable types: `patient`, `encounter`, `diagnosis`, `user`.

### 15.2 Backend additions (`emr-api`)

| Layer | File | Change |
| --- | --- | --- |
| Permissions | `app/permissions.py` | Added `recyclebin:read` / `recyclebin:restore`, granted to `ADMIN` only. |
| Schemas | `app/schemas/recycle_bin.py` | `RecycleBinQuery`, `RestoreRequest`, `EntityType`. |
| Base service | `app/services/base.py` | New `restore(entity, actor)` helper that clears the delete fields and audits `action=RESTORE`. |
| Service | `app/services/recycle_bin_service.py` | Normalised listing across the four tables + restore with cascade rules. |
| Routes | `app/routes/recycle_bin.py` | `GET /recycle-bin`, `POST /recycle-bin/<entity_type>/<int:entity_id>/restore`. |
| Registration | `app/routes/__init__.py` | Registered the `recycle_bin` blueprint. |
| Tests | `tests/test_recycle_bin.py` | 7 tests defining the contract (all passing). |

**Listing normalisation.** Regardless of source table, each item is shaped as:

```json
{
  "entity_type": "encounter",
  "id": 42,
  "label": "OPD · Nakato Sarah",
  "patient_id": 7,
  "deleted_at": "2026-10-01T09:12:00+00:00",
  "deleted_by_id": 3,
  "delete_reason": "Duplicate entry",
  "record": { "…the full soft-deleted row…" }
}
```

Items are sorted **newest-deleted-first** and paginated in memory.

**Cascade and guard rules** (the interesting part):

- Restoring an **encounter** also restores the **diagnoses that were hidden with it** — matched by
  `delete_reason LIKE "Encounter voided:%"` so unrelated, separately-deleted diagnoses are not
  resurrected.
- Restoring a **diagnosis** whose parent encounter is still deleted fails with `422
  PARENT_STILL_DELETED` (`BusinessRuleError`).
- Restoring a **user** sets `is_active = true`.
- Every restore writes a `RESTORE` audit row; the reason is optional (minimum 5 characters when
  supplied).
- Unknown `entity_type` in the **query string** → `422`; unknown type in the **restore path** →
  `404`.

### 15.3 Frontend additions (`emr-frontend`)

**Type** — appended to `services/http/api-types.ts`:

```ts
export type RecycleBinEntityType = "patient" | "encounter" | "diagnosis" | "user";

export type RecycleBinItem = {
  entity_type: RecycleBinEntityType;
  id: number;
  label: string;
  patient_id: number | null;
  deleted_at: string;
  deleted_by_id: number | null;
  delete_reason: string | null;
  record: Record<string, unknown>;
};
```

**Service** — `services/recycle-bin/recycle-bin-service.ts`:

```ts
import { getList } from "@/services/http/list-helpers";
import { bffRequest } from "@/services/http/bff-client";

export const recycleBinService = {
  list(filters: RecycleBinFilters = {}) {
    return getList<RecycleBinItem>("/recycle-bin", { ...filters });
  },
  restore(entityType: RecycleBinEntityType, entityId: number, reason?: string) {
    return bffRequest(`/recycle-bin/${entityType}/${entityId}/restore`, {
      method: "POST",
      body: { reason: reason?.trim() ? reason.trim() : null },  // always send a JSON body
    });
  },
};
```

Note the two rules encoded here: paths omit `/api`, and restore always sends a JSON body (the
route expects one, even if `{ "reason": null }`).

**Permissions** — `lib/permissions.ts` gained `recycleBinView: "recyclebin:read"` and
`recycleBinRestore: "recyclebin:restore"`, both added to the `ADMIN` set.

**Nav** — `components/app-shell/nav-items.ts` gained a `Trash2`-icon entry pointing at
`/recycle-bin`, gated by `PERMISSIONS.recycleBinView`.

**Component** — `features/recycle-bin/components/recycle-bin-table.tsx`:

- `useCurrentUser()` → `canView` / `canRestore`; renders `<AccessDenied/>` if not permitted.
- SWR key includes the entity-type filter and pagination:
  `` `/recycle-bin?type=${entityType}&page=${page}&per_page=${perPage}` ``.
- A `SelectNative` filters by type (`All / Patient / Encounter / Diagnosis / User`).
- Columns: **Type**, **Record** (`label`), **Deleted** (`formatDateTime`), **By** (`#id`),
  **Reason**, and actions **Details** + **Restore**.
- **Details** opens a `Dialog` showing the metadata and the raw `record` as pretty JSON.
- **Restore** opens a `ConfirmDialog` whose body is an **optional-reason** `FormField` +
  `Textarea` supplied via the dialog's `children` slot; on confirm it calls
  `recycleBinService.restore(...)`, toasts, closes and `mutate()`s.

```tsx
async function confirmRestore() {
  if (!pendingRestore) return;
  setRestoring(true);
  try {
    await recycleBinService.restore(pendingRestore.entity_type, pendingRestore.id, reason);
    toast.success(`${humanizeEnum(pendingRestore.entity_type)} restored`);
    setPendingRestore(null); setReason("");
    await mutate();
  } catch (error) {
    toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
  } finally { setRestoring(false); }
}
```

**Page** — `app/(app)/recycle-bin/page.tsx` is a Server Component: `PageHeader` +
`<RecycleBinTable/>`.

### 15.4 Why the frontend didn't need new plumbing

Because the BFF is generic, adding a whole new backend surface required **zero** changes to
`api-client`, `bff-client`, `list-helpers` or the route handler. A new feature is just a service
string, a hook key, and components — exactly the payoff the layering was designed for.

---

## 16. The Flask API contract this UI is built on

### Envelopes

Success:

```json
{ "data": { }, "meta": { "page": 1, "per_page": 20, "total": 57, "pages": 3 } }
```

Error:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": {}, "request_id": "…" } }
```

### Status → meaning used by the UI

| Status | Handling |
| --- | --- |
| `200/201` | Normal path; `getList`/`getOne`/service returns `data`. |
| `401` | Route handler refreshes once; second failure clears the cookie and returns `SESSION_EXPIRED`. |
| `403` | Shown as an access-denied state (never retried). |
| `404` | "The record could not be found or is no longer available." |
| `409` | Conflict (e.g. state transition not allowed). Surfaced as an error toast. |
| `422` | Validation / business rule (`BusinessRuleError`); field errors when `details` gives them. |
| `5xx` / status `0` | "The EMR service is temporarily unavailable." Retry is offered to the user, not automatic. |

### Contract details that have bitten the UI

- **Delete/cancel/discharge need a JSON body with a `reason`** (min 5 chars). `DELETE` with a body
  works through the BFF because the handler reads `request.arrayBuffer()` for `DELETE` too.
- **Lists use `page`/`per_page`**, max `per_page` 100.
- **Encounter close needs ≥1 diagnosis**; **one `PRIMARY` diagnosis per encounter**.
- **Follow-ups must be scheduled in the future.**
- **Discharge body:** `{ condition_at_discharge, summary(≥10 chars), instructions? }`.
- Everything else soft-deletes and stays queryable via the recycle bin.

---

## 17. Design decisions and why

| Decision | Rationale |
| --- | --- |
| **Next.js (App Router) over a Vite SPA** | The BFF requires a server runtime *anyway*; Next gives the server and the UI in one deployable. Server Components render shells without shipping JS, and route handlers replace a separate Node proxy service. |
| **BFF instead of browser→Flask** | Tokens stay in an `httpOnly` cookie; `FLASK_API_BASE_URL` stays server-side; refresh/retry logic lives in exactly one place; the browser never needs CORS to Flask. |
| **Encrypted stateless cookie (AES-256-GCM)** | No session store to provision or scale; works on any instance; tamper-evident via GCM tag; `v1.` prefix allows rotation. |
| **axios (both sides)** | One HTTP client, interceptable, works in Node and the browser. `validateStatus: () => true` server-side lets callers inspect `401`. |
| **SWR** | Tiny, URL-keyed cache that matches the "filters are the key" pattern; `mutate()` gives cheap post-write refresh; global retry policy centralised in `Providers`. |
| **react-hook-form + zod** | Uncontrolled inputs stay fast; zod schema is the single source of truth for types *and* runtime messages; `z.infer` keeps payload types honest. |
| **shadcn tokens, no bespoke CSS** | Consistent theme and dark mode; tokens (`bg-card`, `text-muted-foreground`, `ring-foreground/10`) instead of ad-hoc colours; `cn` merges classes safely. |
| **Icons, never emoji** | Crisp at all sizes, themeable, accessible (`aria-hidden` where decorative). |
| **`"use client"` only where needed** | Server Components for pages/metadata; client boundary at the interactive component (table/form) to keep bundles smaller. |
| **Mirrored permission map** | Hide controls the role can't use so users don't click into `403`s — while Flask stays authoritative. |

---

## 18. Limitations and trade-offs

Be honest about these in review — they are conscious choices, not oversights.

1. **No automated test suite on the frontend.** Verification is `npm run typecheck` (tsc strict);
   the backend has pytest. A production EMR would add Vitest + Playwright for the clinical flows.
2. **Permission mirror can drift.** `lib/permissions.ts` duplicates the backend matrix. If Flask
   gains a permission and the mirror isn't updated, a control may be hidden or shown wrongly. The
   `403`-is-final rule keeps this safe, not correct.
3. **In-memory pagination in the recycle bin.** Fine for modest volumes; a large soft-delete
   backlog would need a SQL union with real pagination.
4. **SWR cache is per tab, not shared.** No cross-tab updates; `revalidateOnFocus` is off, so a
   colleague's change is only seen on a manual refresh or navigation that remounts a hook.
5. **No optimistic UI.** Writes `await` then `mutate()`. Safe and simple, but a slow link shows a
   spinner rather than a snappy transition.
6. **Polling-free worklists/dashboard.** A clinician leaving a worklist open sees stale data until
   remount. A production EMR might add `refreshInterval` or SSE/WebSocket.
7. **`proxy.ts` is a convenience gate.** It checks cookie *presence* only; without the BFF's
   re-validation it would be false security.
8. **Single-region assumptions.** `Africa/Kampala` is baked into display formatting. Correct for
   the deployment, but not multi-tenant.
9. **No i18n / no offline mode.** English only; requires connectivity.
10. **Audit/detail JSON is dumped raw.** Good for admins, but not a polished diff view.

---

## 19. Extension guide: add a new module

The recipe, in order (each step type-checked before moving on):

1. **Confirm the Flask contract.** Read the route + schema; note path, method, payload, envelope,
   permission, and any status codes. Update `services/http/endpoints.ts` and
   `services/http/api-types.ts` first.
2. **Service** — `services/<feature>/<feature>-service.ts`. Use `getList`/`getOne`/`bffRequest`.
   Paths **without** `/api` or `/v1`.
3. **Schema** — `features/<feature>/schemas/<x>-schema.ts` if there is a form. Mirror Flask's rules
   for friendly feedback; export a `toPayload` mapper.
4. **Hook** — `features/<feature>/hooks/use-<x>.ts`. Build an SWR key from the filters and call the
   service.
5. **Components** — table/form/detail under `features/<feature>/components/`, `"use client"`.
   Reuse `DataTable`, `FormField`, `ConfirmDialog`, `PatientPicker`, `StatusBadge`, the state
   components, and `can()` for gating.
6. **Pages** — `app/(app)/<feature>/page.tsx` (+ `new`, `[id]`, `edit`). Server Components with
   `metadata` and `PageHeader`.
7. **Nav + permissions** — add a `PERMISSIONS` entry if new, grant it per role, and add a
   `NAV_SECTIONS` entry with a lucide icon.
8. **Gate** — `npm run typecheck`, then commit and push.

Worked precedent: the recycle bin followed exactly these steps and needed no infrastructure
changes.

---

## 20. Conventions, gotchas and review checklist

### Hard conventions

- **Icons, not emoji.** lucide primary; `aria-hidden` on decorative icons.
- **shadcn tokens only** — no hard-coded colours, no bespoke CSS files.
- **Paths in services omit `/api` and `/v1`.** `bffRequest` adds `/api`; the server client adds `/api/v1`.
- **`server-only` is a fence.** Don't import `api-client`, `auth-service`, `lib/auth/*` or `lib/env`
  into client code.
- **Validate on the client for UX, trust Flask for truth.**
- **Do not install packages** without an explicit decision.

### TypeScript gotchas seen in this repo

- Passing a callback where the prop type is `() => void | Promise<void>`: wrap async handlers —
  `onConfirm={async () => { await mutate(); }}` rather than `onConfirm={() => mutate()}` if the
  return type is Promise-sensitive.
- After a `null` guard on fetched data, a closure may still see the value as possibly-null
  (`TS18049`). Use the **route param** id for navigation inside the closure, not the fetched object.
- Route handlers: `params` is a `Promise` — `const { path } = await context.params;`.

### PowerShell / git notes

- `git` writes progress to **stderr**; PowerShell surfaces it as a red error even when the push
  succeeded (look for `abc..def  main -> main`).
- Line-ending warnings (`LF will be replaced by CRLF`) are noisy but harmless on Windows.

### Review checklist for a change

- [ ] Contract verified against Flask source, not assumed.
- [ ] Service path has no `/api`/`/v1`; body sent for `DELETE`/`POST` where required.
- [ ] New type added to `api-types.ts`; permission mirrored if the route is protected.
- [ ] Loading / empty / error states all handled (`DataTable` covers these if used).
- [ ] Destructive actions name the exact record and require a reason where the API does.
- [ ] Role gating via `can()`; `403` still honoured.
- [ ] `npm run typecheck` clean.
- [ ] `.env*` untouched; `.env.example` updated if a new variable exists.

---

## 21. Interview Q&A quick answers

**Why Next.js for an existing Flask API?**
The BFF needs a server runtime regardless; Next supplies it and the UI in one deployable. Server
Components render shells without shipping JS, route handlers replace a separate proxy service, and
App Router gives file-based routing and per-route metadata.

**How does authentication work end to end?**
Login posts to `/api/auth/login`; the handler exchanges credentials with Flask, then seals both
tokens into an AES-256-GCM `httpOnly` cookie and returns only the public user. Every later call
goes through the catch-all `/api/[...path]` handler, which decrypts the cookie, attaches the access
token, and refreshes-once on `401`.

**Where could a token leak?**
It shouldn't: tokens never enter a response body, and `FLASK_API_BASE_URL`/`SESSION_SECRET` are
server-only (no `NEXT_PUBLIC_`). The main risk would be logging a payload on the server — the
client is structurally out of reach.

**Why not store tokens in `localStorage`?**
`httpOnly` cookies are not readable by JS, so XSS can't exfiltrate the session; `sameSite: "lax"`
mitigates CSRF; the cookie is the single source of truth across instances.

**Why SWR over React Query/Redux?**
The cache identity is the request URL, which maps perfectly onto "filters → key". SWR is small,
supports `mutate()` for cheap post-write refresh, and lets a single `SWRConfig` own the retry
policy. No global client state was needed.

**How do you handle a user whose role changes?**
`useCurrentUser` is revalidated on navigation/mount; `AppShell` redirects to `/login` if `/auth/me`
fails. Server-side, every request re-checks permissions in Flask, so a stale UI can't grant access.

**Why does the recycle bin need backend work?**
The API never hard deletes, but there was no way to list or restore soft-deleted rows. We added
`recyclebin:read`/`recyclebin:restore` (ADMIN), a normalised listing across the four tables, and a
restore endpoint with cascade rules (encounter restore brings back the diagnoses it hid; a
diagnosis restore fails with `PARENT_STILL_DELETED` if its encounter is still deleted).

**What's the hardest part to get right?**
State transitions and their guard rails — one `PRIMARY` diagnosis per encounter, close needing a
diagnosis, follow-ups in the future, discharge requiring a summary. The UI mirrors them for speed,
but Flask is authoritative, and the UI must surface the resulting `422`/`409` cleanly.

**What would you do before production?**
Add Vitest + Playwright covering login, patient registration/search, encounter close, discharge and
the recycle-bin restore; generate the permission map from a shared source of truth to stop drift;
add live refresh on worklists; and add error monitoring keyed by `request_id`.

**What's your favourite trade-off in this codebase?**
The mirrored permission map. It buys a UI where users never click into a `403`, at the cost of
duplication — and the code is explicit that Flask remains the only authority, so drift is a UX bug,
never a security hole.

---

*If you only remember one thing: the browser talks to `/api`, a single server file translates that
into authenticated Flask calls, and every feature is the same five-part shape. Master that shape and
you can read — or extend — the whole app.*
