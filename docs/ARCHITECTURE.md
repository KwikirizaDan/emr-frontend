# EMR Frontend — Architecture & Implementation Guide

This is the single reference for how the EMR frontend is built. It explains every
layer, form, and API call **once**, using the **Patients module** as the worked
example. Every other module (Encounters, Admissions, Surgeries, Follow-ups,
Users, Audit) follows the exact same pattern, so it is not re-explained here —
see [§9 Module map](#9-module-map-do-not-repeat-this-file).

> Reading order: [§1 Ground rules](#1-ground-rules-and-why) → [§2 Architecture](#2-architecture-at-a-glance)
> → [§3 Request lifecycle](#3-request-lifecycle-a-patient-list-call) → [§4 Layers](#4-the-layer-reference)
> → [§5 Worked example](#5-feature-module-worked-example-patients)
> → [§7 Q&A](#7-project-qa-with-sample-code).

---

## 1. Ground rules (and why)

| Rule | Why |
| --- | --- |
| **TypeScript + TSX** (the blueprint said JSX) | The repo ships `tsconfig.json`, `@types/react`, and typed UI primitives. Types catch contract drift against Flask at compile time; JSX would throw that away. |
| **The browser never talks to Flask directly** | Flask uses bearer tokens + CORS. Calling it from the browser would expose the access/refresh tokens and the API base URL. Instead every call goes to a same-origin Next.js Route Handler (`/api/...`) that holds the tokens in an encrypted cookie. |
| **axios for HTTP** | One client per direction, with interceptors and one normalised error path. `fetch` requires hand-rolling status/JSON/error handling in every call site. |
| **shadcn tokens, never raw CSS values** | `bg-card`, `text-muted-foreground`, `ring-foreground/10`, `text-destructive` keep light/dark parity automatically. Hard-coded hex breaks theming and the design system. |
| **Icons from `lucide-react`, never emoji** | Consistent, accessible, themeable. |
| **Flask is the only authority** | Every client rule (required, max length, role) is a convenience mirror. The server re-validates; a `403` or `422` from Flask always wins. |
| **Server-only code is marked `server-only`** | `lib/env.ts` and `services/http/api-client.ts` import `"server-only"` so a stray client import fails the build instead of leaking secrets. |

---

## 2. Architecture at a glance

```
┌────────────────────────────── Browser (React) ──────────────────────────────┐
│  Page (server component)                                                     │
│    └─ "use client" feature component  ── uses ── SWR hook                    │
│          └─ feature service (services/<domain>/*-service.ts)                 │
│                └─ bffRequest()  ── axios instance, baseURL "/api" ──┐        │
└──────────────────────────────────────────────────────────────────────┼───────┘
                                                                        │  same-origin
┌──────────────────────────────────────────────────────────────────────▼───────┐
│  Next.js Route Handler:  app/api/[...path]/route.ts   (the BFF boundary)       │
│    • resolves + decrypts the session cookie                                   │
│    • attaches the access token                                                │
│    • proxies to Flask, retries once on 401 after refreshing the token         │
│      └─ flaskProxy()  ── axios instance, baseURL `${FLASK_API_BASE_URL}/api/v1`
└──────────────────────────────────────────────────────────────────────┬───────┘
                                                                        │
                                                            ┌───────────▼──────────┐
                                                            │  Flask  emr-api      │
                                                            │  /api/v1/*           │
                                                            └──────────────────────┘
```

There are **two axios instances** and they must not be confused:

- **`services/http/bff-client.ts`** — browser side, `baseURL: "/api"`. Client-safe.
- **`services/http/api-client.ts`** — server side only (`import "server-only"`),
  `baseURL: "${FLASK_API_BASE_URL}/api/v1"`.

---

## 3. Request lifecycle (a patient-list call)

Tracing `usePatients({ q: "nakato", page: 1 })` from click to pixels:

1. **`patients-table.tsx`** debounces the search box, then calls `usePatients(...)`.
2. **`use-patients.ts`** builds a stable SWR key: `/patients?q=nakato&page=1&per_page=20`.
3. SWR (or a mutation) calls **`patientService.list(filters)`**.
4. **`patient-service.ts`** calls `getList<Patient>("/patients", query)`.
5. **`list-helpers.ts`** calls `bffRequest("/patients", { query })` and unwraps `{ data, meta }`.
6. **`bff-client.ts`** issues `GET /api/patients?q=nakato&page=1&per_page=20` with cookies.
7. **`app/api/[...path]/route.ts`** decrypts the session, calls
   `flaskProxy("/patients", { accessToken, query })`.
8. **`api-client.ts`** issues `GET ${FLASK_API_BASE_URL}/api/v1/patients?...` with
   `Authorization: Bearer <token>`.
9. Flask responds `{ data: [...], meta: {...} }`; the body flows back unchanged.
10. `DataTable` renders rows and derives pagination from `meta` (never from `rows.length`).

If Flask returns **401**, step 7 refreshes the token once, rewrites the cookie, and
replays the request. If Flask returns **403/409/422**, the error is normalised into
an `ApiError` and surfaced to the user (see [§4.4](#44-serviceshttpapi-errorts)).

---

## 4. The layer reference

### 4.1 `services/http/endpoints.ts`

The **single source of truth** for Flask paths and query-key names. Feature
services build paths from here so a backend rename is a one-line change.

```ts
export const API_BASE_PATH = "/api/v1";

export const ENDPOINTS = {
  patients: "/patients",
  patient: (id: string | number) => `/patients/${id}`,
  patientTimeline: (id: string | number) => `/patients/${id}/timeline`,
  // ...
} as const;

export const QUERY_KEYS = { search: "q", page: "page", perPage: "per_page" } as const;
```

**Why:** avoids magic strings scattered across services, and documents the
contract next to the code that consumes it.

### 4.2 `lib/env.ts` (server-only)

Reads `FLASK_API_BASE_URL` and `SESSION_SECRET` lazily through getters.

```ts
import "server-only";

export const env = {
  get flaskApiBaseUrl(): string {
    const value = read("FLASK_API_BASE_URL");
    if (!value) throw new Error("FLASK_API_BASE_URL is not configured...");
    return value.replace(/\/+$/, "");
  },
  // ...
} as const;
```

**Why getters, not constants:** a missing variable should fail **at request
time** with a clear message, not crash the build. **Why `server-only`:** importing
this from a client component is a build error, which is exactly the safety net we
want for secrets.

### 4.3 `services/http/api-client.ts` (server axis)

A lazily-created axios instance rooted at Flask, plus three functions:

| Export | Purpose |
| --- | --- |
| `flaskRequest<T>` | Returns `{ status, ok, data, requestId }` **without throwing** on HTTP errors — needed so the auth boundary can inspect a `401`. |
| `apiRequest<T>` | Throws a normalised `ApiError` on non-2xx. Use when you just want the data. |
| `flaskProxy(path, init)` | Re-issues the browser's exact method/body/headers to Flask and returns a `Response`. Used by the BFF route. |

```ts
let client: AxiosInstance | null = null;

function flaskApi(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: `${env.flaskApiBaseUrl}${API_BASE_PATH}`,
      headers: { Accept: "application/json" },
      validateStatus: () => true, // never throw on 4xx/5xx; callers decide
      paramsSerializer: { indexes: null }, // arrays as repeated keys
    });
  }
  return client;
}
```

**Why lazy:** the instance reads `FLASK_API_BASE_URL` at creation. Creating it at
module load would make `next build` fail on machines without a local `.env`.
**Why `validateStatus: () => true`:** the refresh-retry logic needs the raw `401`.
**Why a separate `flaskProxy`:** it forwards raw bytes, so a JSON validation
error from Flask reaches the browser unchanged (including field-level `details`).

### 4.4 `services/http/api-error.ts`

One error type for the whole app.

```ts
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: Record<string, unknown> | null;
  readonly requestId: string | null;

  get isConflict() { return this.status === 409; }
  get fieldErrors(): Record<string, string> { /* maps details → { field: msg } */ }
  get displayMessage(): string { /* safe, never leaks a stack trace */ }
}

export function parseErrorEnvelope(status: number, body: unknown, requestId: string | null): ApiError;
```

**Why:** a toast, an inline field error, and a support reference all read from
the same object. `parseErrorEnvelope` understands Flask's
`{ error: { code, message, details, request_id } }` envelope and falls back to a
status-based message.

### 4.5 `services/http/bff-client.ts` (browser axis)

The only client-side HTTP entry point.

```ts
const bffApi = axios.create({
  baseURL: "/api",          // path "/patients" → "/api/patients"
  headers: { Accept: "application/json" },
  withCredentials: true,
});

export async function bffRequest<T>(path: string, options: BffRequestOptions = {}): Promise<T> {
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
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      throw parseErrorEnvelope(axiosError.response.status, axiosError.response.data, /* requestId */);
    }
    throw new ApiError({ status: 0, message: "Unable to reach the EMR service..." });
  }
}
```

**Why `baseURL: "/api"`:** feature code writes resource paths (`/patients`), not
proxy paths. **Gotcha:** the auth endpoints are *already* under `/api`
(`/api/auth/me`), so calling them must use `/auth/me`, **not** `/api/auth/me`,
which would resolve to `/api/api/auth/me`. This is why `useCurrentUser` uses
`bffRequest("/auth/me")`.

### 4.6 `services/http/list-helpers.ts`

Removes the two most repeated (and most error-prone) shapes.

```ts
export async function getList<T>(path: string, query: ListQuery = {}): Promise<Paginated<T>> {
  const response = await bffRequest<{ data?: T[]; meta?: PaginationMeta }>(path, {
    query: listQuery(query),
  });
  return {
    data: Array.isArray(response?.data) ? response.data : [],
    meta: response?.meta ?? { page: 1, per_page: 20, total: 0, pages: 0 },
  };
}

export async function getOne<T>(path: string): Promise<T | null> {
  const response = await bffRequest<{ data?: T | null }>(path);
  return response?.data ?? null;
}
```

**Why:** every list endpoint returns `{ data, meta }` and every detail endpoint
returns `{ data }`. Centralising the unwrap means a service method is one line and
the `meta` default can never be `undefined` in the UI.

### 4.7 `services/http/api-types.ts`

Plain types mirroring Flask's `to_dict()` output (`Patient`, `Encounter`,
`EncounterDetail`, `Diagnosis`, `Admission`, `Surgery`, `FollowUp`, `User`,
`AuditLog`, worklist items, `Paginated<T>`, …).

**Why a neutral module:** both the server services and the browser hooks need
these types, but neither may import the other's runtime. Types-only avoids
pulling server code into the client bundle.

---

## 5. Feature module (worked example: Patients)

### 5.1 Directory shape

```
services/patients/patient-service.ts          # API calls (one method per endpoint)
features/patients/
  schemas/patient-schema.ts                   # zod form schema + payload mapper
  hooks/use-patients.ts                       # SWR list hook
  components/
    patients-table.tsx                        # search + table + row actions + delete
    patient-form.tsx                          # create/edit form (RHF + zod)
    patient-summary.tsx                        # presentational identity block
    patient-timeline.tsx                      # SWR timeline renderer
    patient-detail.tsx                        # detail page (tabs + actions)
    edit-patient.tsx                          # loads record → renders PatientForm
app/(app)/patients/page.tsx                    # /patients  (list)
app/(app)/patients/new/page.tsx                # /patients/new (create)
app/(app)/patients/[patientId]/page.tsx        # detail
app/(app)/patients/[patientId]/edit/page.tsx   # edit
app/(app)/patients/[patientId]/timeline/page.tsx
app/(app)/patients/[patientId]/encounters/new/page.tsx
```

**Why this split:** `services/` is the only place that knows a URL;
`features/` is the only place that knows a UI. Pages stay tiny (compose a header
with a client component) so routing is obvious.

### 5.2 The service — `services/patients/patient-service.ts`

```ts
export type PatientFilters = { q?: string; page?: number; per_page?: number };

export const patientService = {
  list: (filters: PatientFilters = {}) => getList<Patient>("/patients", { ...filters }),
  getById: (id: string | number) => getOne<Patient>(`/patients/${id}`),
  create: (payload: PatientPayload) => bffRequest<Patient>("/patients", { method: "POST", body: payload }),
  update: (id: string | number, payload: Partial<PatientPayload>) =>
    bffRequest<Patient>(`/patients/${id}`, { method: "PATCH", body: payload }),
  remove: (id: string | number, reason: string) =>
    bffRequest(`/patients/${id}`, { method: "DELETE", body: { reason } }),
  timeline: (id: string | number) => getOne<PatientTimeline>(`/patients/${id}/timeline`),
};
```

**Why:** no React, no hooks, no business logic — just the HTTP contract. It is
trivially unit-testable and reusable from any component. Note `remove` always
sends a `reason` in the **body**; the Flask soft-delete endpoints require it.

### 5.3 The schema — `features/patients/schemas/patient-schema.ts`

```ts
const NAME_PATTERN = /^[A-Za-z][A-Za-z '-]*$/;
const PHONE_PATTERN = /^\+?[0-9 ]{7,20}$/;

export const patientFormSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100).regex(NAME_PATTERN, "..."),
  // ...
  date_of_birth: z.string().min(1, "...").refine((v) => new Date(v) <= new Date(), "Date of birth cannot be in the future"),
  address: optionalText(255),
});

export function toPatientPayload(values: PatientFormOutput) {
  const orNull = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);
  return { ...values, national_id: orNull(values.national_id?.toUpperCase()), address: orNull(values.address) };
}
```

**Why mirror the rules:** instant, friendly feedback without a round-trip.
**Why a separate `toPatientPayload`:** the form works with empty strings for
optional fields, but Flask expects `null`. The mapper is the one place that
translation happens.

### 5.4 The data hook — `features/patients/hooks/use-patients.ts`

```ts
function buildKey(filters: PatientFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  params.set("page", String(filters.page ?? 1));
  params.set("per_page", String(filters.per_page ?? 20));
  return `/patients?${params.toString()}`;
}

export function usePatients(filters: PatientFilters = {}) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(buildKey(filters),
    () => patientService.list(filters));
  return { rows: (data?.data ?? []) as Patient[], meta: data?.meta ?? null, isLoading, isValidating, error, mutate };
}
```

**Why an explicit key:** SWR caches by key. Serialising the filters guarantees
"same filters → same cache entry" and "different page → different entry".
**Why return `mutate`:** destructive actions call it to revalidate the exact
current page after a change.

### 5.5 The table — `features/patients/components/patients-table.tsx`

Owns search debounce, pagination state, and the delete flow. Column definitions
are declared inline (no separate `columns/` folder) to keep the module small.

```tsx
const columns: DataTableColumn<Patient>[] = [
  { id: "mrn", header: "MRN", cell: (p) => <span className="font-mono text-xs">{formatMrn(p.mrn)}</span> },
  { id: "name", header: "Patient", cell: (p) => <Link href={`/patients/${p.id}`}>{p.last_name}, {p.first_name}</Link> },
  { id: "age", header: "Age", cell: (p) => formatAge(p.date_of_birth) },
  { id: "actions", header: <span className="sr-only">Actions</span>, className: "text-right", cell: (p) => (/* View / Edit / Delete, permission-gated */) },
];

<DataTable
  rows={rows}
  columns={columns}
  getRowId={(p) => p.id}
  loading={isLoading}
  error={error}
  onRetry={() => void mutate()}
  meta={meta}
  onPageChange={setPage}
  onPerPageChange={(size) => { setPerPage(size); setPage(1); }}
  empty={<EmptyState icon={UserRound} title="No patients yet" .../>}
/>
```

Row actions are wrapped in `can({ role: user?.role }, PERMISSIONS.patientDelete)`.
Deleting opens the shared `ConfirmDialog` with a **required reason**, then calls
`patientService.remove(id, reason)` and `mutate()`.

**Why columns inline:** a patient table is used once; a separate file adds a hop
without reuse. **Why `getRowId`:** React needs a stable key that is the record id,
not an array index.

### 5.6 The form — `features/patients/components/patient-form.tsx`

One component serves **create and edit**; presence of the `patient` prop decides.

```tsx
const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PatientFormValues>({
  resolver: zodResolver(patientFormSchema),
  defaultValues: { first_name: patient?.first_name ?? "", sex: patient?.sex ?? "FEMALE", ... },
});

async function onSubmit(values: PatientFormValues) {
  try {
    const payload = toPatientPayload(patientFormSchema.parse(values));
    if (patient) { await patientService.update(patient.id, payload); router.push(`/patients/${patient.id}`); }
    else         { const created = await patientService.create(payload); router.push(`/patients/${created.id}`); }
    router.refresh();
  } catch (error) {
    if (isApiError(error) && error.isConflict) { setDuplicateId(error.details?.existing_patient_id); setFormError(error.message); return; }
    setFormError(isApiError(error) ? error.displayMessage : "The request could not be completed.");
  }
}
```

Fields are rendered through `FormField`, which wires label → control → error
with `aria-describedby`:

```tsx
<FormField id="first_name" label="First name" required error={fieldMessage(errors.first_name)}>
  {(control) => <Input {...control} {...register("first_name")} autoComplete="off" />}
</FormField>
```

**Why React Hook Form + zod:** uncontrolled inputs (fewer re-renders) with a
single schema that also drives the payload mapper. **Why `fieldMessage`:** RHF
errors are `unknown`; this helper safely extracts `.message`. **Why handle `409`
specially:** the API returns `existing_patient_id` for a duplicate, which we turn
into a link to the existing record instead of a dead end.

### 5.7 Presentational & detail components

- **`patient-summary.tsx`** — pure, no data fetching: renders the identity grid.
  Props in, markup out, so it is easy to storybook or reuse in a print view.
- **`patient-timeline.tsx`** — SWR over `/patients/{id}/timeline`, maps each
  `TimelineEvent.type` to a lucide icon and humanises `details`.
- **`patient-detail.tsx`** — fetches the patient, renders a header with
  permission-gated actions (New encounter / Book follow-up / Edit) and `Tabs`
  for Overview and Timeline.
- **`edit-patient.tsx`** — a thin loader: fetch by route param, then render
  `PatientForm patient={patient}`. Keeps `PatientForm` free of routing concerns.

**Pattern:** *loaders* fetch and delegate; *forms* submit; *presentational*
components receive props and render. Mixing these makes components hard to test.

### 5.8 Pages & routing

```tsx
// app/(app)/patients/page.tsx  — server component, tiny
export const metadata = { title: "Patients" };
export default function PatientsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Patients" description="Search the register..." />
      <PatientsTable />
    </div>
  );
}
```

Pages under `app/(app)/` are protected by the `AppShell` layout and the
`proxy.ts` cookie gate. Dynamic routes read params from a `Promise` (Next.js 16):

```tsx
export default async function Page({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  return <EncounterForm patientId={patientId} />;
}
```

**Why pages stay server components:** they can export `metadata` and read route
params on the server, then hand off to a `"use client"` component for anything
interactive.

---

## 6. Shared UI contracts (write once, reuse everywhere)

| Component | Contract | Why |
| --- | --- | --- |
| `DataTable<T>` | `{ columns, rows, getRowId, loading, error, onRetry, empty, meta, onPageChange, onPerPageChange }` | Server-driven pagination from `meta`; built-in loading/empty/error states so every clinical table behaves identically. |
| `FormField` | Render-prop with `{ id, "aria-describedby", "aria-invalid" }` | Guarantees every field is labelled and its error is announced to screen readers. |
| `SelectNative` | Native `<select>` styled with input tokens | Dependable, progressive-enhancement friendly, no portal. The richer shadcn `Select` stays available for custom menus. |
| `PatientPicker` | `{ value: Patient \| null; onChange; disabled }` | Server-side patient search; never downloads the whole register. Reused by encounter, admission, surgery and follow-up forms. |
| `ConfirmDialog` | Optional `reasonLabel`/`reasonValue`/`reasonError` | Consequential actions (soft-delete, cancel) require an audited reason of ≥5 characters. |
| `WorkflowStatusBadge` | `{ status }` → tone via `toneForStatus` | Status is never colour-only: icon + label always present. Unknown statuses are neutral, never guessed. |
| `EmptyState` / `ErrorState` / `LoadingState` | Standard states | Consistent, and `ErrorState` renders `ApiError.displayMessage`. |
| `PageHeader` | `{ title, description, actions? }` | Uniform page chrome. |

Toast convention: success → `toast.success(...)`; failure →
`toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.")`.

### Permissions

`lib/permissions.ts` mirrors the role matrix for **hiding controls only**:

```tsx
const canCreate = can({ role: user?.role }, PERMISSIONS.patientCreate);
{canCreate ? <Button render={<Link href="/patients/new" />}>Register patient</Button> : null}
```

**Why it is not security:** a hidden button is a UX nicety. Flask authorises every
request; the UI must still handle a `403` gracefully.

### Auth & session

- `proxy.ts` redirects to `/login` when the session cookie is absent (convenience
  gate only).
- `app/api/auth/*` handlers own login/logout/refresh/me.
- `app/api/[...path]/route.ts` is the only place a `401` triggers a refresh; it
  retries **at most once**.

### Secrets & threat model

**What can reach the browser:** only variables prefixed `NEXT_PUBLIC_`. None are
configured — `FLASK_API_BASE_URL` and `SESSION_SECRET` are unprefixed, and
`lib/env.ts` starts with `import "server-only"`, so importing it from a client
component fails the build instead of bundling the secret.

**What the browser holds:** the `emr_session` cookie — AES-256-GCM ciphertext,
`httpOnly` (JS cannot read it), `SameSite=Lax`, `Secure` in production. The
access and refresh tokens live *inside* that ciphertext; the browser never sees a
bearer token or the Flask base URL.

**What `.env` does and does not protect against:**

- Protects against browser exposure — but that is the prefix rule, not `.env`.
- Does **not** protect against server-side leakage: a committed `.env` (gitignored
  here — `.env*` with `!.env.example`), a compromised host, container layers, CI
  logs or stack traces.
- `SESSION_SECRET=somedemo-text` in `.env.example` is a placeholder; a weak value
  weakens the cookie encryption even when nothing leaks.

**Residual browser risks:** XSS does not need the cookie — same-origin script can
still call `/api/...` as the signed-in user. Mitigate with React's default
escaping (no `dangerouslySetInnerHTML`) and a CSP, not with `.env`. CSRF is
mitigated by `SameSite=Lax` plus same-origin JSON requests.

The API's request log records `auth=yes/no` and a request id, never the
`Authorization` value, so tokens do not reach the console either.

---

## 7. Project Q&A (with sample code)

### Q1. Why axios instead of `fetch`?

One `ApiError` path and one place to configure base URLs/params.

```ts
// bff-client.ts — every failure becomes an ApiError
try { return (await bffApi.request<T>({ /* ... */ })).data; }
catch (error) {
  const e = error as AxiosError;
  if (e.response) throw parseErrorEnvelope(e.response.status, e.response.data, requestId);
  throw new ApiError({ status: 0, message: "Unable to reach the EMR service..." });
}
```

### Q2. Why does the browser call `/api/...` instead of Flask?

Secrets. Tokens and the Flask base URL live only in the server Route Handler.

```ts
// app/api/[...path]/route.ts (server)
let response = await flaskProxy(apiPath, { method, accessToken: resolved.session.accessToken, query, body, contentType });
if (response.status === 401) { /* refresh once, rewrite cookie, replay */ }
return response;
```

### Q3. Why is `bffRequest`'s base URL `/api` — and how do auth routes work?

Feature paths like `/patients` become `/api/patients`. Auth routes already start
with `/api`, so you pass `/auth/me`, never `/api/auth/me`:

```ts
const CURRENT_USER_KEY = "/auth/me";            // ✅ → /api/auth/me
// const CURRENT_USER_KEY = "/api/auth/me";     // ❌ → /api/api/auth/me
```

### Q4. Why not call the Flask `/users` list to populate a "surgeon" dropdown?

There is **no non-admin endpoint** that lists clinicians. Inventing one would
fail for doctors/nurses. Instead, forms default the clinician to the current user
when their role qualifies, and the server validates.

```ts
// Surgery form: lead_surgeon_id defaults to the signed-in surgeon
const defaultLeadSurgeonId = user?.role === "SURGEON" ? Number(user.id) : undefined;
```

### Q5. Why a custom `DataTable` when `@tanstack/react-table` is installed?

Clinical tables are server-paginated and need identical loading/empty/error
behaviour. A thin table driven by the API's `meta` is less code and less risk
than configuring TanStack's client-side model for every list.

```tsx
const page = meta?.page ?? 1;
const pages = meta?.pages ?? (rows.length > 0 ? 1 : 0); // never trust rows.length for pagination
```

### Q6. Why native `<select>` (SelectNative) rather than shadcn `Select`?

Native controls are accessible and portal-free, which matters inside dialogs and
forms. shadcn `Select` remains for custom menus.

```tsx
<SelectNative {...control} {...register("sex")}>
  <option value="FEMALE">Female</option>
  <option value="MALE">Male</option>
</SelectNative>
```

### Q7. Why mirror Flask validation in zod?

For instant feedback and to avoid a pointless request. Flask still decides.

```ts
const optionalText = (max: number) =>
  z.string().max(max, `Must be ${max} characters or fewer`).optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : ""));
```

### Q8. Why does every DELETE send a `reason`?

Soft-delete and cancel transitions are audited; Flask rejects a reason shorter
than 5 characters. The shared `ConfirmDialog` collects it.

```ts
remove: (id, reason) => bffRequest(`/patients/${id}`, { method: "DELETE", body: { reason } });
```

### Q9. Why `server-only` imports?

To make leaking a secret a **compile** error rather than a runtime surprise.

```ts
// lib/env.ts
import "server-only"; // importing this from a "use client" file fails the build
```

### Q10. Why is the server axios instance created lazily?

It reads `FLASK_API_BASE_URL` when constructed; building it eagerly would break
`next build` without a local env file.

```ts
let client: AxiosInstance | null = null;
function flaskApi() {
  if (!client) client = axios.create({ baseURL: `${env.flaskApiBaseUrl}${API_BASE_PATH}`, validateStatus: () => true });
  return client;
}
```

### Q11. Why does SWR only retry transport errors?

A `403`/`409` will not fix itself; retrying it just hammers a clinical API.

```tsx
function shouldRetry(error: unknown): boolean {
  const status = (error as ApiError | undefined)?.status;
  return status === 0 || status === undefined;
}
```

### Q12. Why TypeScript/TSX when the blueprint said JSX?

The project ships typed UI primitives and `@types/react`; types catch contract
drift against Flask at compile time. The blueprint's formatting was advisory.

### Q13. Why does `FormField` use a render-prop instead of cloning children?

It keeps accessibility wiring explicit and avoids fragile `React.cloneElement`.

```tsx
{children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}
```

### Q14. Why unwrap `{ data, meta }` in `getList`/`getOne`?

So a service method is one line and no component ever sees `undefined` meta.

```ts
return { data: Array.isArray(response?.data) ? response.data : [], meta: response?.meta ?? { page: 1, per_page: 20, total: 0, pages: 0 } };
```

---

## 8. Module map (do not repeat this file)

Every module is `service → schema → hook → components → pages`, exactly as in
§5. Only the endpoints and field names differ.

| Module | Service | Feature folder | Notes |
| --- | --- | --- | --- |
| Patients | `services/patients/patient-service.ts` | `features/patients/` | Reference implementation (§5). |
| Encounters | `services/encounters/encounter-service.ts` | `features/encounters/` | Adds a close transition and a nested-diagnosis form; closed encounters are read-only. |
| Admissions / Wards | `services/admissions/admission-service.ts` | `features/admissions/`, `features/wards/` | Bed occupancy comes from `/wards/{id}/beds`; discharge requires condition + summary. |
| Surgeries | `services/surgeries/surgery-service.ts` | `features/surgeries/` | State machine: schedule → start → complete / cancel (reason required). |
| Follow-ups | `services/followups/followup-service.ts` | `features/followups/` | Must be scheduled in the future; status changes are audited. |
| Users | `services/users/user-service.ts` | `features/users/` | Admin only; create/edit/reset-password/delete (reason required). |
| Audit logs | `services/audit/audit-service.ts` | `features/audit/` | Read-only, filterable by actor/entity/date. |
| Worklists | `services/worklists/worklist-service.ts` | `features/worklists/` | Inpatients / surgeries / follow-ups; feeds the dashboard panels. |

---

## 9. Adding a new module (checklist)

1. Add/confirm the endpoint in `services/http/endpoints.ts`.
2. Add response types to `services/http/api-types.ts`.
3. Write `services/<domain>/<domain>-service.ts` using `getList` / `getOne` / `bffRequest`.
4. Write `features/<domain>/schemas/<domain>-schema.ts` (zod + payload mapper).
5. Write `features/<domain>/hooks/use-<domain>.ts` with an explicit SWR key.
6. Build the table/form/detail components from the shared primitives.
7. Add pages under `app/(app)/<domain>/` replacing the `RoutePlaceholder`.
8. Gate every action with `can({ role }, PERMISSIONS.*)`.
9. Run `npm run typecheck` and `npm run build`.
10. Commit and push.

---

## 10. Gotchas & troubleshooting

- **Double `/api` prefix** (`/api/api/...`) — you passed an `/api/...` path to
  `bffRequest`, which already has `baseURL: "/api"`. Pass the resource path.
- **`useSearchParams` build warning** — wrap the client component in `<Suspense>`.
- **`params`/`searchParams`** are `Promise`s in Next.js 16 — always `await` them.
- **Empty query values** — `bffRequest` and `listQuery` drop `null`/`undefined`/`""`
  so the URL stays clean.
- **Never fabricate clinical data** — render `—` for a missing MRN/phone, and only
  show dashboard metrics Flask actually returned.
