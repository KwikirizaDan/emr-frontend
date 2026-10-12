# GSI Practical Assessment — Question Bank & Answers

Global Surgical Initiative — Full-Stack Developer, EMR / Hospital Management System.

This is the **question bank**: the questions the panel is most likely to ask, mapped to
the seven scored areas in the brief, each answered against the **actual code** in this
repo (`emr-frontend`) and the API repo (`emr-api`). It complements:

- `INTERVIEW_GUIDE.md` — run-of-show, pre-flight, demo script, live-change plans.
- `ARCHITECTURE.md` — layer-by-layer code map and request lifecycle.

> Verify line numbers the morning of the session — code moves. The behaviours and
> identifiers below are stable.

---

## 0. Answer shape, and the disclosure you must make first

**Answer in three layers** (this is what scores "Communication & code defence"):

1. **Headline** — one sentence, the decision.
2. **Mechanism** — the 2–4 files/tables that implement it.
3. **Trade-off** — what it costs, and what you'd change at scale. Never claim a system
   is perfect; name the limitation before the panel finds it.

**Disclosure (state this unprompted — the brief requires it):**

> "This is a system I built from scratch, not a downloaded EMR. The language, framework
> choice and database were mine: Next.js App Router + TypeScript on the front, Flask +
> SQLAlchemy + PostgreSQL on the back. I used AI assistance for scaffolding and
> documentation, and I can justify every material decision and change any file live.
> The AI-use disclosure is written up in `emr-api/README.md`."

---

## 1. Assessment map — where each competency is demonstrated

| Scored area (weight) | Where it lives | Lead files |
| --- | --- | --- |
| Backend/API & business logic (15%) | Flask routes → services → models | `app/routes/*`, `app/services/*`, `app/utils.py` |
| Database modelling & integrity (15%) | Constraints, partial unique indexes, migrations | `app/models/*`, `migrations/versions/*` |
| Security & authorization (15%) | JWT, RBAC, rate limit, validation, BFF boundary | `app/permissions.py`, `app/middleware.py`, `app/jwt_callbacks.py`, `lib/auth/*`, `app/api/**` |
| Healthcare/EMR workflow correctness (10%) | 6-stage journey, state machines | `app/services/*_service.py` |
| Frontend & usability (10%) | App Router pages, forms, worklists | `app/(app)/**`, `features/**` |
| Testing & debugging (10%) | pytest suite, permission matrix | `tests/**` |
| Architecture & maintainability (10%) | Layering, DI, docs | `ARCHITECTURE.md`, `DEPENDENCY_INJECTION.md` |
| Deployment / operations (5%) | Docker, gunicorn, env config | `Dockerfile`, `docker-compose.yml`, `app/config.py` |
| Auditability & record integrity (5%) | Append-only audit, soft delete, optimistic lock | `app/services/audit_service.py`, `app/models/audit.py` |
| Communication & code defence (5%) | This file + `INTERVIEW_GUIDE.md` | — |

---

## 2. The clinical scenario — the appendicitis journey end to end

**Scenario:** 34-year-old with severe abdominal pain → assessed → diagnosed acute
appendicitis → admitted → appendectomy → discharged after 2 days → follow-up in 7 days.

| Stage | UI | API call (permission) | Integrity rule that fires |
| --- | --- | --- | --- |
| 1. Registration | `/patients/new` | `POST /api/v1/patients` (`patient:create`) | unique MRN (sequence), unique `dedupe_key`, unique `national_id`; duplicate → **409** `DUPLICATE_PATIENT` |
| 2. Consultation | `/encounters/new` | `POST /api/v1/encounters` (`encounter:create`), then `POST /api/v1/encounters/{id}/diagnoses` (`diagnosis:create`, ICD-10 `K35.8`, `PRIMARY`/`CONFIRMED`), then `POST /api/v1/encounters/{id}/close` (`encounter:close`) | clinician must be active DOCTOR/SURGEON; only one `PRIMARY` diagnosis per encounter; close requires ≥1 diagnosis |
| 3. Admission | `/admissions/new` | `POST /api/v1/admissions` (`admission:create`) | one active admission per patient **and** per bed (partial unique indexes); bed row is `with_for_update()` locked |
| 4. Surgery | `/surgeries/new` | `POST /api/v1/surgeries` (`surgery:create`), then `POST /api/v1/surgeries/{id}/start` and `/complete` (`surgery:transition`) | lead must be active SURGEON; theatre + surgeon overlap checked; only the lead surgeon may start/complete; status machine `SCHEDULED → IN_PROGRESS → COMPLETED` |
| 5. Discharge | `/admissions/{id}` → Discharge | `POST /api/v1/admissions/{id}/discharge` (`admission:discharge`) | blocked while a surgery is `SCHEDULED`/`IN_PROGRESS`; writes a `Discharge`, flips admission to `DISCHARGED` |
| 6. Follow-up | `/follow-ups/new` | `POST /api/v1/followups` (`followup:create`) | `scheduled_at` must be in the future; appears on the timeline + worklist |

**Longitudinal record:** `GET /api/v1/patients/{id}/timeline` (`timeline:read`) returns the
patient plus events of type `ENCOUNTER`, `ADMISSION`, `DISCHARGE`, `SURGERY`, `FOLLOW_UP`,
newest first — the "patient history" screen (`features/patients/patient-timeline.tsx`).

**Every write above also writes an `audit_logs` row in the same transaction** (see §3.D).

---

## 3. Competency questions and answers

### A. Full-stack development — structure, business logic, key paths

**Q: Walk me through the request path from a button click to the database.**
A: Three hops.
1. **Browser → Next BFF.** A feature component calls `bffRequest("/patients")`
   (`services/http/bff-client.ts`, axios `baseURL:"/api"`, `withCredentials`). That hits
   the catch-all route `app/api/[...path]/route.ts`.
2. **BFF → Flask.** The BFF reads the encrypted `emr_session` cookie, decrypts the
   access token (`lib/auth/session.ts`), and forwards to Flask via `flaskProxy`
   (`services/http/api-client.ts`, base `FLASK_API_BASE_URL + /api/v1`) with a Bearer
   header.
3. **Flask → DB.** Route (`app/routes/patients.py`) → `@requires_permission("patient:read")`
   → service (`app/services/patient_service.py`) → SQLAlchemy → PostgreSQL. The response
   is the `{data, meta}` envelope, proxied back verbatim.

**Files:** `app/api/[...path]/route.ts`, `services/http/{bff-client,api-client}.ts`, `app/routes/patients.py`, `app/services/patient_service.py`.

**Q: Why a BFF at all — why not call Flask from the browser?**
A: So **tokens never reach JavaScript**. The cookie is `httpOnly`, `sameSite=lax`,
`secure` in production, and the token inside it is AES-256-GCM encrypted. The browser
only knows `/api/*` on its own origin; it never sees the Flask URL or a JWT. This also
makes CORS unnecessary (same origin) and lets the BFF do one refresh-retry.

**Q: What are the layers in the API?**
A: Route (HTTP + validation + permission) → service (business rules + transaction +
audit) → model (schema/constraints). Routes are thin; all rules live in services so they
are reusable and testable. `utils.py` provides the `ok`/`created` envelopes and pydantic
`parse_body`/`parse_query`.

**Q: How do you add a new resource/module?**
A: Three files + a migration: `app/models/x.py`, `app/services/x_service.py`,
`app/routes/x.py` (a `DocsBlueprint` with `@requires_permission`), register it in
`app/routes/__init__.py`, add the model import in `app/models/__init__.py`, generate a
migration. Frontend: a `services/x/x-service.ts`, a `features/x/` module, and a page.

**Q: Where is the "one place" for validation?**
A: Two places by design: **client** (zod + React Hook Form via `zodResolver`) for fast
feedback, and **server** (pydantic schemas via `parse_body`/`parse_query`) as the
authority — unknown fields are rejected. The client is never trusted.

---

### B. Database modelling & integrity

**Q: Show the core relationships.**
A: `Patient 1─* Encounter 1─* Diagnosis`; `Patient 1─* Admission *─1 Bed *─1 Ward`;
`Admission 1─1 Discharge`; `Admission 1─* Surgery`; `Patient 1─* FollowUp`;
`User 1─* AuditLog`; `User 1─* RefreshToken`. FKs are declared in the models and
enforced by the DB; relationships use `back_populates`.

**Q: How do you prevent duplicate patients?** (this is a "serious weakness" area)
A: Two deterministic keys, both **unique at the DB level**:
- `dedupe_key` = `lower(first_name)|lower(last_name)|date_of_birth|sex` (unique).
- `national_id` (unique, nullable, uppercased on write).
`patient_service._check_duplicates` returns **409** with the existing record id;
`IntegrityError` is caught as a backstop for concurrent inserts. The frontend surfaces a
"View the existing record" link on that 409.

**Trade-off:** deterministic keys miss typos/nicknames. A real MPI would add fuzzy/
phonetic matching + a review queue. Named explicitly as a limitation.

**Q: How is the MRN generated?**
A: A PostgreSQL sequence `patient_mrn_seq` via `nextval`, formatted `MRN-%06d`. DB-side
generation means no race between concurrent registrations.

**Q: What stops two patients occupying one bed, or two primary diagnoses?**
A: **Partial unique indexes** (in migration `0001`):
- `uq_admissions_one_active_per_patient` on `admissions(patient_id) WHERE status='ADMITTED'`
- `uq_admissions_one_active_per_bed` on `admissions(bed_id) WHERE status='ADMITTED'`
- `uq_diagnoses_one_primary` on `diagnoses(encounter_id) WHERE diagnosis_type='PRIMARY' AND deleted_at IS NULL`

So the rule holds even if two requests race past the service check. Bed admission also
takes a `SELECT … FOR UPDATE` row lock.

**Q: How do you handle concurrent edits (lost updates)?**
A: **Optimistic locking.** `Patient`, `Encounter`, `Admission`, `Surgery`, `FollowUp`
each have a `version` column via `__mapper_args__={"version_id_col": version}`. A stale
write raises SQLAlchemy `StaleDataError`, handled globally as **409** "This record was
changed by someone else. Reload and try again."

**Q: Migrations?**
A: Alembic via Flask-Migrate. Two versions: `0001_initial_schema` (all tables,
constraints, partial indexes, the MRN sequence) and `0002_audit_log_append_only` (the
append-only trigger). `flask db upgrade` is run on container start. `DATABASE_MIGRATIONS.md`
documents the workflow.

**Q: Transactions?**
A: One commit per service call. The business change **and** its audit row are added to
the same `db.session` and committed together, so they are atomic — if the write fails,
neither persists (tested in `tests/test_audit.py`).

---

### C. Security & authorization

**Q: Where is authorization enforced, and what stops a restricted user calling the API
directly?** (the brief says the panel will test this directly)
A: **Server-side, on every endpoint**, via `@requires_permission("…")` in
`app/permissions.py`, which stacks `@jwt_required()` and checks
`permission in ROLE_PERMISSIONS[user.role]`. The UI's `lib/permissions.ts` gate is
**display-only**; the server is the sole authority. Demo it: log in as `nurse`, then
`curl -X POST /api/v1/patients` with the nurse's Bearer token → **403 FORBIDDEN** with
`details: {required: "patient:create"}`. The `tests/test_permissions.py` parametrised
matrix asserts this for every role × endpoint.

**Q: List the roles and the maximum role.**
A: `ADMIN`, `REGISTRAR`, `NURSE`, `DOCTOR`, `SURGEON`. **ADMIN is the maximum** — it is
the union of every clinical permission plus `user:manage`, `ward:manage`, `patient:delete`,
`audit:read`, `recyclebin:read`, `recyclebin:restore`. Note ADMIN has *no* clinical
authoring rights beyond the union of others by design (it manages, it doesn't diagnose).

**Q: How do authentication tokens work?**
A: Flask-JWT-Extended. Short-lived access token (~15 min) + refresh token (~7 days).
Refresh tokens are **stored in `refresh_tokens` (jti + expiry)** and the blocklist loader
checks them, so logout/refresh-rotation/deactivation revoke them immediately. Access
tokens are stateless (short-lived, not individually revocable — a named trade-off).

**Q: How are passwords stored?**
A: Werkzeug hashes (`set_password`/`check_password`), never plaintext, never returned
(`hidden_fields=("password_hash",)`). Failed logins run a dummy hash compare so timing
doesn't reveal whether a username exists, and both a wrong password and an unknown user
return the same error.

**Q: How do you stop brute force?**
A: In-process fixed-window rate limiter (`app/middleware.py`): a global default per
minute plus a **stricter `/api/v1/auth/login` rule** (default 10/min). Over the limit →
**429** `RATE_LIMITED` with `Retry-After`. Configurable and toggleable via `RATELIMIT_*`.

**Trade-off:** the counter is per worker process (in-memory), so with N gunicorn workers
the effective limit is N×. Production fix: Redis. Named explicitly.

**Q: Secrets and config?**
A: **No hard-coded secrets.** `app/config.py` reads only from the environment using
`_env`/`_env_int`/`_env_bool`, which **raise** (`Missing required environment variable`)
when absent — there are no fallback defaults. `.env` is gitignored; `.env.example`
lists names only. On the frontend only `FLASK_API_BASE_URL` and `SESSION_SECRET` are read,
both **server-only**; no `NEXT_PUBLIC_*` secret reaches the browser.

**Q: PHI/confidentiality protections to mention.**
A: httpOnly+encrypted session cookie (XSS can't read tokens); `X-Content-Type-Options:
nosniff` and `Cache-Control: no-store` on every API response; CORS locked to configured
origins; role checks on reads too (a registrar cannot read clinical notes); audit of who
viewed which patient (`VIEW`).

---

### D. Auditability & clinical-record integrity

**Q: How would you trace who changed a diagnosis yesterday?**
A: `GET /api/v1/audit-logs?entity_type=diagnosis&entity_id=…&date_from=…&date_to=…`
(`audit:read`, ADMIN). Each row carries `action` (`UPDATE`), `user_id`/`username`,
`old_values`/`new_values` (only the changed fields — `_NOISE` drops
`updated_at`/`updated_by_id`/`version`), `ip_address`, `request_id`, and `created_at`.
`tests/test_audit.py` asserts exactly this with old/new values.

**Q: Can anyone edit or delete the audit log?**
A: No. There is **no write endpoint** for `audit_logs` (405), and migration
`0002_audit_log_append_only` installs a PostgreSQL trigger
`audit_logs_no_update_delete` that raises on `UPDATE`/`DELETE` — append-only at the DB.

**Q: How do you prevent unsafe deletion/overwriting of clinical records?**
A: Five layers:
1. **Soft delete** — `deleted_at`, `deleted_by_id`, `delete_reason` (reason required),
   via `SoftDeleteMixin`. Nothing clinical is physically removed.
2. **Queries hide deleted** — list/get filter `deleted_at IS NULL`; `get_or_404` treats
   soft-deleted as missing.
3. **No delete endpoint** for admissions, surgeries, discharges, follow-ups — they
   change **state** (`DISCHARGED`, `CANCELLED`, …), preserving history.
4. **Recycle bin** — ADMIN-only `GET /recycle-bin` and
   `POST /recycle-bin/{entity_type}/{id}/restore`, itself audited.
5. **Optimistic locking + partial unique indexes + row locks** stop silent overwrites.

**Q: What does an audit row contain?**
A: `action` (`CREATE`/`UPDATE`/`DELETE`/`RESTORE`/`STATUS_CHANGE`/`VIEW`/`LOGIN`/
`LOGIN_FAILED`/`LOGOUT`/`TOKEN_REFRESH`), `entity_type`/`entity_id`, `patient_id`
(for patient-scoped tracing), `old_values`/`new_values` (JSONB), `username` (denormalised
so failed logins survive), `ip_address`, `request_id`, `created_at`.

---

### E. Frontend & usability

**Q: How is the frontend structured?**
A: Next.js App Router (Next 16.4, React 19). Route groups: `app/(app)/**` (authenticated
workspace) and `app/(public)/**` (login). Each feature is a vertical slice:
`services/<d>/…-service.ts` → `features/<d>/schemas/…` (zod) → `features/<d>/components/…`
→ a thin server-component page. Shared UI in `components/ui` (shadcn/base-ui) and
`components/shared`.

**Q: How is data loaded?**
A: Client-side via **SWR** + `bffRequest`. Server components are deliberately thin
(metadata + page header + one client feature). SWR is tuned for a clinical workspace:
`revalidateOnFocus:false`, retry only on transport errors (not 403/409),
`dedupingInterval:2000`.

**Q: How is the longitudinal record shown?**
A: `patient-timeline.tsx` fetches `/patients/{id}/timeline` and renders merged
encounters/admissions/discharges/surgeries/follow-ups newest-first with icons and status
badges.

**Q: Validation and error UX?**
A: zod + React Hook Form (client) mirrors the pydantic schemas (server). Server errors
come back as the `{error}` envelope; `ApiError.displayMessage` maps codes, forms show a
`role="alert"` message, tables/detail actions raise a `sonner` toast, and `ErrorState`
prints the `request_id` for support. 409 duplicates link to the existing record.

**Q: Accessibility/responsiveness?**
A: Semantic tables, labelled form fields (`FormField`), focus-visible rings, `aria-invalid`
on errors, and a desktop-first layout (the mobile sidebar branch was intentionally removed).

---

### F. APIs & integration — laboratory, pharmacy, insurance/claims, other EMRs (HL7/FHIR)

**Q: Describe the API as a product.**
A: Versioned REST under `/api/v1`, JSON envelopes (`{data, meta}` / `{error}`), JWT Bearer
auth, RBAC per endpoint, cursor-friendly pagination (`page`/`per_page` + `meta`), stable
error codes, `X-Request-ID` correlation on every request/response, and an OpenAPI 3 spec
at `/docs` (`/docs/openapi.json`) generated from the code. This is the contract an
integrator would build against.

**Q: How would the EMR integrate with a laboratory (LIS)?**
A: Two directions:
- **Outbound order:** when a clinician orders a test, create a `ServiceRequest`
  (FHIR R4) or an **HL7 v2 `ORM^O01`** message and send to the LIS (REST or MLLP).
- **Inbound result:** the LIS pushes a result; we ingest **`ORU^R01`** (HL7) or a FHIR
  **`DiagnosticReport` + `Observation[]`** bundle and attach it to the patient.
- **Terminology:** observations are coded with **LOINC**; values typed (numeric, string,
  coded). Critical-value flags trigger a notification.
- **Idempotency:** the inbound `Observation.identifier` / HL7 `MSH-10` control id is
  stored unique so duplicate deliveries don't double-post.

**Q: Pharmacy?**
A: FHIR **`MedicationRequest`** (order) and **`MedicationDispense`** (dispense) — or HL7
v2 `OMP^O09`/`RDE^O11`. Drugs coded with **RxNorm** (or ATC). Interaction/allergy checks
happen at the pharmacy system; we hold the order and dispense status on the encounter and
surface it on the timeline.

**Q: Insurance / claims?**
A: Eligibility and claims use the X12 + FHIR pair:
- Eligibility check: **270/271** (or FHIR **`Coverage`** + `CoverageEligibilityRequest/Response`).
- Claim submission: **837P/837I** to a clearinghouse (or FHIR **`Claim`**).
- Remittance/denial: **835** (or FHIR **`ClaimResponse`**).
- Prior authorisation: **278**.
Diagnoses already carry **ICD-10** codes on `Diagnosis.code`, which is the bridge to
claims; procedures would need CPT/SNOMED added.

**Q: Another hospital's EMR / an HIE?**
A: Share **`Patient`** and **`Encounter`** via FHIR, or push ADT (**`ADT^A01`** admit,
**`A08`** update, **`A03`** discharge). Patient matching uses an **MPI** (our
`national_id` + demographics feed it); **`Consent`** resources gate what may be shared.

**Q: HL7 v2 vs FHIR — your awareness?**
A: HL7 v2 is the ubiquitous, pipe-delimited, event-driven messaging standard (ADT, ORM,
ORU, ORM/DFT) still dominant in hospitals — great for events, weak on querying and
schema. FHIR (R4) is the modern REST/JSON resource model — great for querying and
app-level integration, and what we'd expose natively. In practice you run an
**integration engine** (e.g. Mirth Connect) to translate between them and to fan out to
legacy systems. **SMART on FHIR** would let third-party apps (and our own UI) launch
against our FHIR facade with OAuth2 scopes. Terminology services (LOINC/SNOMED/ICD-10/
RxNorm) keep codes consistent.

**Q: How would you build this into the current codebase?**
A: The **service layer is the integration seam**. An inbound adapter is a webhook route
that validates a signature, maps the external payload to our models in a service, writes
the change + an audit row in one transaction, and stores the external id for idempotency.
Outbound is a queue + worker with retries and a dead-letter queue, plus an **outbox** so
we never lose an event if the remote is down. A **`fhir/` mapper module** converts our
models ↔ FHIR resources (a `DiagnosticReport` is a result on an `Encounter`; an
`Observation` is a coded finding), and our `X-Request-ID` gives end-to-end tracing across
the seam. Remember integration is **PHI in motion**: mTLS/HTTPS, signed payloads, least
privilege, and audit every message.

**Q: What's the honest state today?**
A: We expose a clean internal REST API and an OpenAPI contract; **no HL7/FHIR endpoint
ships yet**. The models already carry the seams (`Diagnosis.code` for ICD-10, patient
identifiers, encounter/order-shaped data), so the integration work is additive, not a
rewrite — and I'd build it behind the service layer with an outbox, exactly as above.

---

### G. Testing & debugging

**Q: What's tested, and how do you run it?**
A: pytest against a **real PostgreSQL** test DB (`TEST_DATABASE_URL`), 52 passing + 1
skipped. `conftest.py` recreates the schema per test and seeds six users across the five
roles plus a ward with beds. Coverage: auth (rotation, reuse, deactivation), a
**parametrised role→endpoint 403 matrix**, patient dedupe/MRN/soft-delete, all business
rules (one primary diagnosis, one admission per bed, theatre/surgeon conflicts, discharge
guards), the full 6-stage workflow, audit (old/new values, atomicity, no write endpoints),
recycle-bin restore, and demo seeding. Run: `.\.venv\Scripts\python.exe -m pytest -q`.

**Q: How would you debug a failed request live?**
A: Use the `request_id`. Every response carries `X-Request-ID`; the API logs one line per
request (`method path -> status in Nms (client=…, auth=…, req=…)`). `ErrorState` in the UI
prints the same id. Flow: read the status + `error.code` → grep the API log by request id
→ if 4xx, it's validation/permission/business (the code names the rule) → if 5xx, check
the traceback and DB. For a 403, decode the token's role vs the endpoint's required
permission.

**Q: Reproduce a defect exercise (the brief runs one).**
A: Method: (1) capture the exact request + `request_id`; (2) confirm which layer — UI,
BFF, API, DB; (3) read the failing layer's log/state; (4) write a failing test first;
(5) fix at the right layer (rule in the service, constraint in the model/migration,
message in the UI); (6) re-run the suite. Being able to say "I'd prove it with a test
before touching code" scores.

**Trade-off:** the frontend has **no automated tests** (only `typecheck`/`lint`/`build`).
Named as a gap; the plan is Vitest for schemas/hooks + Playwright for the journey.

---

### H. Architecture & scalability

**Q: How does this grow from 1 clinic to many facilities and thousands of staff?**
A:
1. **Stateless API** — JWT, no server session — so it scales horizontally behind a load
   balancer. Run many gunicorn workers/containers.
2. **Shared state out of process** — move the in-memory rate limiter and any cache to
   **Redis** (Redis also unlocks distributed locking).
3. **Database** — connection pooling (`pool_pre_ping` already on), indexes on every FK
   and hot filter, `EXPLAIN ANALYZE` for slow queries, then read replicas; consider
   partitioning `audit_logs` by month (it's append-only and grows fast).
4. **Multi-tenancy** — add an `organisation`/`facility` column and scope every query
   (row-level security in Postgres is the strong form). Today it's single-facility.
5. **Caching** — Redis for dashboard/worklist aggregates.
6. **Async work** — background workers for integrations, exports, notifications.
7. **Observability** — structured logs (have it), metrics + traces (add OpenTelemetry).

**Q: Where are the current bottlenecks?**
A: The JWT user-lookup hits the DB every request; the rate limiter is per-process; audit
writes double the write volume on clinical updates; `ILIKE` patient search won't scale to
millions (add `pg_trgm` + GIN). All named in §7.

**Q: How is it kept maintainable?**
A: Strict layering (route → service → model), one error format, docs-as-code
(`ARCHITECTURE.md`, `BACKEND_GUIDE.md`, `DEPENDENCY_INJECTION.md`, this file), consistent
naming, and a 6-step "add a module" checklist.

---

### I. Deployment & operations

**Q: How is it deployed?**
A: `Dockerfile` builds a slim Python image, runs `flask db upgrade && gunicorn --workers 3
--bind 0.0.0.0:8000 'app:create_app()'` as a non-root user; `docker-compose.yml` runs
PostgreSQL 16 + the API with a healthcheck and a persistent volume. Frontend is
`next build` + `next start`. Both sit behind nginx (see `docs/NGINX.md`): `/` and `/api/*`
→ Next (the BFF), optional `/api/v1/*` and `/docs` → Flask.

**Q: SSL, secrets, config?**
A: TLS terminates at nginx (Let's Encrypt/`certbot`); the session cookie is `Secure` in
production, so HTTPS is mandatory. Secrets come from the environment/secret manager —
`config.py` fails fast if any are missing. Nothing sensitive ships in the repo or the
frontend bundle.

**Q: Backups and recovery?**
A: `pg_dump` nightly + WAL archiving for point-in-time recovery, stored encrypted and
off-site; **restore is rehearsed to staging** (an untested backup is not a backup). The
append-only audit trigger protects log integrity. Document the RPO/RTO. On Windows dev,
the `pgdata` volume is the local copy.

**Q: Logging and monitoring?**
A: One structured line per request with method, path, status, latency, client, auth
flag, and `request_id`; error logs carry the exception. Next: ship logs centrally
(Loki/ELK), add metrics (latency, error rate, saturation) and alerting.

---

### J. Source control & handover

**Q: Two repos — why, and how would another dev continue?**
A: `emr-api` (Flask) and `emr-frontend` (Next.js) are separate deployables with their own
`.env.example`, tests and pipeline. A new developer: clone both, copy `.env.example` →
`.env`, `docker compose up` (or create the DB + `flask db upgrade` + `flask seed-demo`),
`npm ci && npm run dev`. The docs cover setup (`RUN.md`), migrations
(`DATABASE_MIGRATIONS.md`), testing (`TESTING.md`), architecture, and this Q&A.

**Q: Commit/PR hygiene to highlight?**
A: Small, self-describing commits; `.env` gitignored while `.env.example` is tracked; the
API repo's DI/architecture docs travel with the code; tests run in CI-less local mode but
are one command.

---

## 4. Code review & technical defence — the seven panel questions

These are the brief's own questions. Keep each answer to ~60 seconds, then let them pick
a file.

1. **Where is authorization enforced, and what stops a restricted user calling the API
   directly?**
   → `app/permissions.py`, `@requires_permission` stacks `@jwt_required()`; the UI gate
   (`lib/permissions.ts`) is display-only. Demo: nurse token POSTs `/patients` → 403.

2. **How do you prevent duplicate patients, invalid states and unsafe deletion?**
   → `dedupe_key` + `national_id` unique + 409; **state machines** in the services
   (`TRANSITIONS` in surgery/follow-up); **soft delete + no delete endpoints for
   admissions/surgeries/discharges/follow-ups + recycle bin + optimistic locking**.

3. **How would you trace who changed a diagnosis yesterday?**
   → `GET /audit-logs?entity_type=diagnosis&entity_id=…` with old/new values, actor,
   IP, `request_id`; append-only via DB trigger. (`tests/test_audit.py`.)

4. **How would you diagnose a slow system used by hundreds of staff?**
   → Request-id latency logs → find the hot endpoint → `EXPLAIN ANALYZE` and index →
   check N+1 and pool exhaustion → scale workers/replicas → cache aggregates in Redis →
   add metrics/APM. (Full version in §6.)

5. **How would you back up and restore after server/DB failure?**
   → `pg_dump` + WAL/PITR, encrypted and off-site, restore rehearsed to staging; audit is
   append-only; secrets in a manager. (§3.I.)

6. **How would you integrate lab, pharmacy, insurance and another hospital EMR?**
   → Service layer as the seam; HL7 v2 (ORM/ORU/ADT) + FHIR (ServiceRequest,
   DiagnosticReport/Observation, MedicationRequest/Dispense, Coverage/Claim/ClaimResponse);
   integration engine + outbox + idempotency + audit. (§3.F.)

7. **Which parts would you redesign before production, and why?**
   → Redis-backed rate limiting/cache; frontend tests; idempotency keys + outbox for
   integrations; multi-facility tenanting; probabilistic MPI; access-token revocation;
   structured logs/metrics/tracing; PHI/consent controls. (§7.)

---

## 5. Live change exercise — playbooks

The brief's examples, each as an impact chain you can narrate while coding.

**General checklist every change walks:** model → migration → schema (pydantic) → service
rule → route/permission → OpenAPI → frontend type → service → form/UI → tests. Then run
`flask db upgrade` and `pytest -q`, and `npm run typecheck`.

**5.1 Assign multiple surgeons to one operation**
- DB: new `surgery_participants(surgery_id FK, surgeon_id FK, role ENUM('LEAD','ASSISTANT'),
  unique(surgery_id, surgeon_id))`; keep `lead_surgeon_id` for the workflow guard or
  migrate it as the LEAD row.
- Backend: surgery schema accepts `assistant_surgeon_ids: List[int]`; the service validates
  each is an active `SURGEON` and re-checks **availability for every participant**;
  `start`/`complete` allow any participant (or keep lead-only).
- API: extend `POST /surgeries` request model; response includes participants.
- Frontend: multi-select in `surgery-form.tsx`; render participants in `surgery-detail`.
- Tests: double-book with a shared assistant must 409 `SURGEON_BUSY`.

**5.2 Add/change a theatre field**
- Model + migration (additive, nullable first → backfill → not-null). `Surgery.theatre`
  already exists as a string; a stronger design is a `theatres` table so it's reference
  data. Update the schedule form, conflict-check query, and any worklist display.

**5.3 Introduce a new follow-up status** (e.g. `RESCHEDULED`)
- DB: alter the `ck_follow_ups_status` CHECK constraint (migration).
- Service: add it to `FOLLOWUP_STATUSES` and the `TRANSITIONS` map; add any guard (e.g.
  a reason).
- API type + frontend `WorkflowStatusBadge`/form option; tests for the transition.

**5.4 Add a user permission**
- `app/permissions.py`: add the string to the right `ROLE_PERMISSIONS` sets (ADMIN unions
  automatically); guard the endpoint with `@requires_permission("…")`.
- `/auth/me` already returns effective permissions; mirror in `lib/permissions.ts` for nav
  gating; add a row to `tests/test_permissions.py`.

**5.5 Change a validation rule** (e.g. reason ≥ 5 → ≥ 10, phone pattern)
- Server pydantic schema (authority) **and** client zod schema (mirror) **and** both tests.
  Client-only changes are a bug; server-only changes hurt UX — do both.

**5.6 Expose a controlled API endpoint** (e.g. `GET /patients/{id}/summary`)
- Route with `@requires_permission("patient:read")`, response schema, service query
  (single joined query, paginate if a list), OpenAPI summary, `tests/` for 200 + 403.
- Frontend: add to `ENDPOINTS`, a `patient-service` method, consume via `bffRequest`
  (the BFF passes any `/api/<path>` through automatically).

**Say while coding:** "This is additive and reversible; the migration is nullable-first so
deploying doesn't break old instances; the service keeps the rule so the API and any
future caller stay consistent; and I'll prove it with a test."

---

## 6. Incident / scenario questions

**Q: Hundreds of staff report slowness. Diagnose it.**
A: (1) **Measure** — pull latency from the request logs by `request_id`; identify the
slow endpoint (likely lists/worklists/dashboard). (2) **DB** — `EXPLAIN ANALYZE`; add
missing indexes (FKs already indexed; patient search needs `pg_trgm`+GIN); check for N+1
and lock contention (the bed/admission locks can queue). (3) **App** — connection pool
exhaustion; gunicorn worker count vs CPU; the per-request JWT lookup adds a query — cache
it. (4) **Relieve** — cache aggregates (dashboard/worklist) in Redis; scale replicas.
(5) **Prevent** — metrics, alerts, slow-query log, load test. Name the two known
per-process limits (rate limiter, cache).

**Q: The database server dies. Walk the recovery.**
A: Fail over to the standby (streaming replication) or restore the latest base backup +
replay WAL to the last committed transaction (PITR) → point the app at it (config only)
→ verify with `/api/v1/health` (it does `SELECT 1`) → confirm the append-only audit
trigger and constraints exist → reconcile any in-flight integration messages via the
outbox/DLQ. RPO/RTO are set by backup frequency; the nightly dump + WAL gives minutes.

**Q: A user says "the patient list is empty" but data exists.**
A: Check the Axios/SWR error first (`ErrorState` shows the `request_id`): a 401 means the
session expired (BFF should have refreshed once); a 403 means the role lacks
`patient:read`; a 200 with empty `data` means the search/soft-delete filter matched
nothing. Then check the API log by request id.

---

## 7. Limitations & what I'd redesign before production

State these before you're asked — it reads as ownership, not weakness:

1. **Rate limiting is per-process (in-memory).** → Redis + shared counters so the limit
   is global across workers.
2. **No frontend automated tests.** → Vitest for schemas/hooks, Playwright for the
   journey.
3. **No integration endpoints yet** (HL7/FHIR). → FHIR facade + integration engine +
   outbox + idempotency (§3.F).
4. **Single-facility.** → add `organisation_id`, scope all queries, Postgres row-level
   security.
5. **Patient matching is deterministic, not an MPI.** → fuzzy/phonetic + review queue.
6. **Access tokens aren't individually revocable** (short-lived only). → shorter TTL +
   optional denylist or token version.
7. **Observability is logs only.** → metrics + traces (OpenTelemetry) + alerts.
8. **`SESSION_SECRET` rotation invalidates all sessions** (cookie has a version, not a
   key id). → key-id + rotate with overlap.
9. **`ILIKE` search won't scale.** → `pg_trgm` + GIN.
10. **No field-level/PHI or consent gating**; audit `VIEW` rows add write volume. →
    consent model + sampled/async audit for reads.

---

## 8. Quick-reference cheat sheet

**Endpoints (all under `/api/v1`):**
`POST/GET /patients`, `/patients/{id}`, `/patients/{id}/timeline` ·
`POST/GET /encounters`, `/encounters/{id}`, `/encounters/{id}/close`,
`/encounters/{id}/diagnoses`, `/diagnoses/{id}` · `GET/POST /wards`,
`POST /wards/{id}/beds` · `POST/GET /admissions`, `/admissions/{id}`,
`/admissions/{id}/discharge` · `POST/GET /surgeries`, `/surgeries/{id}`,
`/surgeries/{id}/{start|complete|cancel}` · `POST/GET /followups`, `/followups/{id}`,
`/followups/{id}/status` · `GET /dashboard`, `/worklists/{inpatients|surgeries|followups}` ·
`GET /audit-logs` · `GET /recycle-bin`, `POST /recycle-bin/{type}/{id}/restore` ·
`POST /auth/{login|refresh|logout}`, `GET /auth/me` · `GET /health`.

**Roles → headline permissions:**
`REGISTRAR` patient:create/update + followup · `NURSE` patient:read, encounter:create/update,
admission:create · `DOCTOR` + diagnosis, close encounter, discharge · `SURGEON` + surgery
all · `ADMIN` everything + user/ward/audit/recycle-bin/patient:delete.

**Statuses:** Encounter `OPEN|CLOSED` · Admission `ADMITTED|DISCHARGED` ·
Surgery `SCHEDULED|IN_PROGRESS|COMPLETED|CANCELLED` ·
Follow-up `SCHEDULED|COMPLETED|CANCELLED|MISSED` ·
Discharge condition `RECOVERED|IMPROVED|UNCHANGED|TRANSFERRED|LEFT_AGAINST_ADVICE|DECEASED`.

**Error codes:** `VALIDATION_ERROR` 422 · `BUSINESS_RULE_VIOLATION` 422 ·
`UNAUTHORIZED`/`TOKEN_EXPIRED`/`INVALID_TOKEN`/`TOKEN_REVOKED` 401 · `FORBIDDEN` 403 ·
`NOT_FOUND` 404 · `CONFLICT` 409 (stale write, duplicate) · `RATE_LIMITED` 429 ·
`INTERNAL_ERROR` 500 · `SERVICE_UNAVAILABLE` 503 (BFF can't reach Flask).

**Env (names only):** API — `APP_ENV`, `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`,
`TEST_DATABASE_URL`, `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS`, `CORS_ORIGINS`,
`RATELIMIT_ENABLED`, `RATELIMIT_DEFAULT_PER_MINUTE`, `RATELIMIT_LOGIN_PER_MINUTE`,
`LOG_LEVEL`. Frontend — `FLASK_API_BASE_URL`, `SESSION_SECRET` (both server-only).

**Commands:** API `flask db upgrade` · `flask seed-demo` · `pytest -q` ·
`gunicorn --workers 3 --bind 0.0.0.0:8000 'app:create_app()'`. Frontend `npm run dev` ·
`npm run build && npm start` · `npm run typecheck`.

**Demo creds:** `admin` / `Demo@12345` (and seeded REGISTRAR/NURSE/DOCTOR/SURGEON users).

---

## 9. Communication & defence tips

- **Own the trade-off.** Every "how" answer ends with one honest limitation and the fix.
- **Point at code.** Name the file, then the function; be ready to open it.
- **Prove with a test or a curl.** "I'll show you the 403" beats "it's secure".
- **Don't overclaim.** Say "not built yet; here's exactly how I'd build it" for
  integration, frontend tests, and multi-tenancy.
- **Narrate the live change** through the layers before typing.
- **AI disclosure** up front, per the brief.
