# GSI Full-Stack Interview — Personal Playbook

> Read this once end-to-end the night before, then use **§2 (run of show)** and
> **§7 (live change)** as your on-the-day cue cards. Everything here maps to the
> GSI *Practical Assessment Instructions*.

This guide covers the **whole solution** — the Flask API (`emr-api`) and the
Next.js client (`emr-frontend`). The API README is the authoritative contract;
this document is the interview lens on top of it.

---

## 1. The three sentences that matter

Say these when you open, and again if you get lost:

1. **"It's a two-repository EMR that runs one complete patient journey end to end
   — registration, consultation, admission, surgery, discharge, follow-up."**
2. **"Business rules live in services and the database, not in the UI; the UI only
   mirrors permissions, the API enforces them."**
3. **"Nothing clinical is ever hard deleted, every change is audited in the same
   transaction, and I can prove it in the audit log."**

---

## 2. Run of show (the ~3 hours)

| Block | Time | What you do | Cue |
| --- | --- | --- | --- |
| Structured technical interview | 20 min | Pitch, repo tour, architecture, one code path | §3, §4 |
| Practical demonstration + live change | 90 min | The appendicitis journey, then the change exercise | §5, §7 |
| Code review & defence | 40 min | Open the files, answer the bullets | §8 |
| Architecture / deployment / integration / incident | 20 min | Ops + integration + a "slow system" scenario | §9, §10, §11 |
| Panel scoring | 10 min | — | — |

**Golden rule of the live change:** narrate the method out loud before you type:
*database → model → migration → schema → service → route → audit → tests → UI.*
They score your reasoning, not whether you finish.

---

## 3. Pre-flight checklist

**The day before**

- [ ] `git status` clean and pushed in **both** repos (`emr-api` `master`,
  `emr-frontend` `main`). A dirty tree during "source control & handover" looks bad.
- [ ] `emr-api`: `.venv` works; `flask db upgrade`; `flask seed-demo`.
- [ ] `emr-api`: `pytest -q` passes (~1 min).
- [ ] `emr-frontend`: `npm install`; `npm run typecheck` clean; `npm run dev` loads.
- [ ] `python scripts/demo_journey.py http://localhost:5000` runs green.
- [ ] Complete the **AI disclosure** in both READMEs (see §14).

**30 minutes before (on the interview laptop, offline-safe)**

- [ ] PostgreSQL running; `flask run` on `:5000`; `next dev` on `:3000`.
- [ ] Log into each demo user once so the browser has the session.
- [ ] Open a DB client (psql / pgAdmin / TablePlus) pointed at `emr_dev`.
- [ ] Open the visible tabs you will need (§4).
- [ ] Have `docs/OFFLINE_TROUBLESHOOTING.md` handy for the "no network" failure
  (the app is designed to work against a local API only).

**Demo users** (password `Demo@12345`):

| User | Role | Use it to show |
| --- | --- | --- |
| `admin` | ADMIN | Audit log, recycle bin, wards, secretarial — **no clinical access** |
| `registrar` | REGISTRAR | Registration, search, book follow-up |
| `nurse` | NURSE | Triage encounter, admission |
| `doctor` | DOCTOR | Diagnosis, close encounter, discharge, follow-up |
| `surgeon` | SURGEON | Schedule / start / complete surgery |
| `surgeon2` | SURGEON | Prove "only the lead surgeon can start/complete" |

---

## 4. Tabs to have open

**`emr-api`**

- `app/permissions.py` — roles + `@requires_permission`.
- `app/services/patient_service.py` — duplicate prevention.
- `app/services/admission_service.py` — bed lock + `SELECT ... FOR UPDATE`.
- `app/services/surgery_service.py` — overlap check + transition table.
- `app/services/audit_service.py` and `migrations/versions/0002_*.py` — audit + trigger.
- `tests/test_permissions.py` — "restricted users can't call the API".
- `README.md` — the contract (sections 5–18).

**`emr-frontend`**

- `app/api/auth/login/route.ts` and the other `app/api/auth/*` BFF handlers — token handling.
- `services/http/bff-client.ts` / `api-client.ts` — the two HTTP layers.
- `lib/permissions.ts` — the UI mirror (and why it is *only* a mirror).
- `features/patients/**` — one feature done end to end (schema → hook → table → page).
- `proxy.ts` — edge auth gate.

---

## 5. The clinical scenario — exact demo script

Scenario: **34-year-old with severe abdominal pain → acute appendicitis →
appendectomy → discharge after 2 days → follow-up in 7 days.**
Fictional patient: *Jane Nakato, FEMALE, DOB 1992-03-14, national ID 19920314-12345.*

For every write, after it succeeds, switch to `admin` and show the audit row.

### Stage 1 — Registration (`registrar`)

- Go to `/patients` → **New patient**. Fill the demographics. Save.
- **Point out:** generated `MRN-000001`; optimistic-locking `version` column.
- **Prove duplicate prevention:** register the same name + DOB + sex again →
  `409 DUPLICATE_PATIENT` with the existing id. (Same happens via national ID.)
- **Say:** matches on name, MRN, national ID or phone; the check is in
  `patient_service._check_duplicates` **and** a unique `dedupe_key` /
  `national_id` in the database, so a race can't slip through.

### Stage 2 — Consultation (`doctor`)

- Open Jane → `/patients/{id}` → **New encounter**: type `EMERGENCY`,
  chief complaint "severe abdominal pain at 22:00". Save.
- Add **diagnosis**: "Acute appendicitis", ICD-10 `K35.80`, PRIMARY, CONFIRMED.
- Try to add a **second PRIMARY** → rejected (partial unique index + service
  check).
- Try to **close the encounter** before a diagnosis exists → `422`.
  Now close it → succeeds; the encounter becomes **locked** (no further edits).
- **Say:** only one PRIMARY per encounter; a closed encounter is immutable.

### Stage 3 — Admission (`nurse`)

- `/admissions/new` → choose Jane's encounter, a free bed in `Ward A`, reason.
- `/wards` now shows the bed occupied (occupancy is **derived** from active
  admissions — it cannot drift).
- **Prove the guards:** admit Jane again → `409 ALREADY_ADMITTED`; admit another
  patient to the same bed → `409 BED_OCCUPIED`.
- **Say:** the bed row is locked with `SELECT ... FOR UPDATE` and a partial unique
  index enforces one `ADMITTED` row per patient and per bed.

### Stage 4 — Surgery (`surgeon`)

- `/surgeries/new`: procedure "Appendectomy", theatre `Theatre 1`,
  `lead_surgeon = surgeon`, scheduled start/end. Save.
- **Prove overlap:** schedule another surgery in `Theatre 1` at the same time →
  `409 THEATRE_BOOKED` (same for the same surgeon: `SURGEON_BUSY`).
- **Start** → **Complete** with outcome notes. Save the record.
- **Prove ownership:** log in as `surgeon2` and try to start `surgeon`'s case →
  `403` (only the lead surgeon may start/complete).
- Show it on `/worklists/surgeries?day=...`.

### Stage 5 — Discharge (`doctor`)

- Open the admission → **Discharge**: condition `IMPROVED`, summary, instructions.
- **Say:** discharge is blocked while a surgery is `SCHEDULED`/`IN_PROGRESS`; the
  discharge record is write-once; the bed frees automatically.
- Back on `/wards`, the bed is free.

### Stage 6 — Follow-up (`doctor` or `registrar`)

- `/follow-ups/new`: schedule **7 days ahead**, reason "post-op review".
- Show it on `/worklists/follow-ups` **and** in the patient's longitudinal record
  `/patients/{id}/timeline`.

### Close with the audit trail (`admin`)

- `/audit-logs` → filter by `patient_id = Jane` and walk the history:
  CREATE patient → CREATE encounter → CREATE diagnosis → CREATE admission →
  CREATE surgery → STATUS_CHANGE → CREATE discharge → CREATE follow-up.
- **Say:** each row has who, what, old/new values, IP, `request_id`, and time; the
  log is append-only via a database trigger (`UPDATE`/`DELETE` raise).

---

## 6. Competency cheat sheet

| Competency | One-line answer | Where to point |
| --- | --- | --- |
| Full-stack | Next.js BFF → Flask `/api/v1` → SQLAlchemy → PostgreSQL | `services/http/*`, `app/routes/*` |
| Database & integrity | Constraints + service checks together; partial unique indexes; optimistic locking | README §6–7; migrations |
| Security | JWT + rotating refresh; server-side permissions; role read from DB every request | `permissions.py`, `auth_service.py` |
| Auditability | Append-only log, old/new values, same transaction | `audit_service.py`, migration `0002` |
| Frontend & usability | Search/registration, worklists, dashboard, usable nav, validation | the 6-stage demo |
| APIs & integration | Clean JSON contract; FHIR/HL7 facade is the next layer | README §11, §16 |
| Testing & debugging | 50+ pytest incl. permission & workflow tests; debug via `request_id` → logs → `EXPLAIN ANALYZE` | `tests/` |
| Architecture & scalability | Layered services; add workers, pooling, read replica, cache | §11 |
| Deployment & ops | gunicorn + nginx + TLS, migrations on deploy, `pg_dump`/WAL/restore drills | §9 |
| Source control & handover | Two repos, documented, scripted demo, disclosure | both READMEs |

---

## 7. Live change exercise — method + ready plans

**The method (say it every time):**

> Database → model → migration → schema → service (rules + audit) → route with a
> permission → tests → frontend surface. Then answer: *which tables change, which
> migration, who may call it, what is audited, which test proves it, and what
> happens to existing data.*

**Ready plans for the likely requests** (full detail in the API README §15):

- **Multiple surgeons on one operation** — new `surgery_surgeons` join table (unique
  `(surgery_id, surgeon_id)`), keep `lead_surgeon_id`; validate + overlap-check each
  assistant; return the team; test a busy assistant. Migration required.
- **Add a theatre field** — `theatre` already exists as a string; to promote it to a
  table add `theatres` + `theatre_id` FK + a data migration copying existing names,
  then switch the overlap check to the id.
- **New follow-up status (e.g. `RESCHEDULED`)** — add to `FOLLOWUP_STATUSES`, the
  Pydantic `Literal`, and the `TRANSITIONS` table; hand-write a migration that drops
  and recreates `ck_follow_ups_status`; test the new transition.
- **Add a user permission** — add the string to `ROLE_PERMISSIONS`, decorate the
  route with `@requires_permission("new:permission")`, add a permission test.
  **No migration.**
- **Change a validation rule** — edit the Pydantic schema (format/ranges) or the
  service (business rule); test old **and** new behaviour.
- **Expose a controlled endpoint** — new service function (owns rules + audit), a
  thin route with `@requires_permission`, return only the fields the caller needs,
  add a permission test.

**Frontend impact to mention:** schema change → update the zod schema, the service
path, the SWR hook, and the form; permissions change → update
`lib/permissions.ts` **and** the backend (UI mirror only).

---

## 8. Code review & defence — model answers

**Q: Where is authorization enforced, and what stops a restricted user calling the
API directly?**
`app/permissions.py` — every route is wrapped in `@requires_permission`. The role
is read **from the database on every request**, not trusted from the token, so a
deactivation or role change is immediate. `tests/test_permissions.py` calls every
sensitive endpoint with the wrong role and asserts `403`. The UI mirror
(`lib/permissions.ts`) only hides controls; it is never the gate.

**Q: How do you prevent duplicate patients, invalid states and unsafe deletion?**
Duplicate: two checks — `patient_service._check_duplicates` (friendly `409` with
the existing id) plus unique `dedupe_key`/`national_id`. Invalid states: transition
tables in services, `CHECK` constraints, partial unique indexes, and locked closed
encounters. Unsafe deletion: nothing is hard deleted — soft delete with a required
reason, deleted rows stay for history and duplicate checks, a recycle bin restores
them, and admissions/surgeries/discharges/follow-ups have **no** delete endpoint at
all (they change state with a reason).

**Q: How would you trace who changed a diagnosis yesterday?**
`GET /api/v1/audit-logs?entity_type=diagnosis&entity_id=12&action=UPDATE`, or the
SQL in README §9. Each row records username, action, `old_values`/`new_values`,
IP, `request_id` and time; `log_update` stores only the fields that actually
changed.

**Q: How would you diagnose a slow system used by hundreds of staff?**
Start at the evidence: `request_id` in the response → server logs; then
`EXPLAIN ANALYZE` the slow query; confirm the indexes on foreign keys, dates and
`(theatre, start)`; worklists are single-join paginated queries. Then scale:
more gunicorn workers, PgBouncer connection pooling, a read replica for reports,
cache ward data, and turn on `pg_stat_statements` + metrics/alerts. (Full version
in README §16.)

**Q: How would you back up and restore after server/database failure?**
`pg_dump -Fc emr > emr_$(date +%F).dump`; restore with
`pg_restore -d emr_new emr.dump`. Production: enable WAL archiving for
point-in-time recovery, encrypt and ship copies off-site, and **test restores on a
schedule** (an untested backup is not a backup). Document RTO/RPO.

**Q: How would you integrate laboratory, pharmacy, insurance, another EMR?**
Add an integration layer rather than coupling modules: model exchanges as FHIR
resources (`ServiceRequest`, `Observation`, `MedicationRequest`, `Claim`) or HL7 v2
messages through a queue, with idempotency keys, retries and a dead-letter queue,
code-mapping tables, and an audit entry for every exchange. Patient identity: MRN
plus national-ID matching and a merge workflow.

**Q: Which parts would you redesign before production?**
The honest list in README §17: one role per user, single facility (no tenant
column), theatre/surgeon double-booking checked only in the service (a `btree_gist`
exclusion constraint is stronger), no access-token revocation before 15-minute
expiry, no rate limiting/lockout/MFA, no field-level encryption, no FHIR endpoints,
and the audit trigger exists only in migrated databases.

---

## 9. Deployment & operations — the answer

- **Linux/server:** Ubuntu LTS; app served by **gunicorn** (multiple workers)
  behind **nginx/Caddy** terminating TLS; PostgreSQL on the same host or managed;
  systemd units for both processes.
- **TLS:** HTTPS everywhere, HSTS, `Secure`/`httpOnly`/`SameSite` cookies. (The
  refresh token already lives in an encrypted `httpOnly` cookie set by the Next.js
  BFF.)
- **Migrations:** take a backup, then `flask db upgrade` as a deploy step; never
  edit an applied migration.
- **Secrets/config:** environment variables from a secret manager, never in git
  (`.env` is ignored; `.env.example` is tracked). Rotate keys. Separate dev/test/prod.
- **Backups/recovery:** nightly `pg_dump` + WAL archiving, encrypted off-site,
  documented RTO/RPO, regular restore drills.
- **Observability:** structured logs with `request_id`, central log shipping,
  metrics, uptime checks and alerts on error rate and latency.
- **Maintenance:** `flask purge-tokens` daily for expired refresh tokens.

---

## 10. Integration & interoperability

- **Today:** a clean, versioned JSON API (`/api/v1`) with one error envelope and
  `X-Request-ID` for tracing.
- **Next layer (design, not built):** a FHIR facade (`Patient`, `Encounter`,
  `ServiceRequest`, `Observation`, `MedicationRequest`, `Claim`) and/or an HL7 v2
  bridge, behind a queue with idempotency keys, retries and a dead-letter queue.
- **Terminology:** ICD-10 codes are already stored on diagnoses, which maps cleanly
  to FHIR codings later.
- **Identity:** cross-system matching on MRN + national ID with a patient-merge
  workflow to avoid duplicates across facilities.

---

## 11. Scalability & architecture

- Layered: routes (HTTP) → schemas (validation) → services (rules, transactions,
  audit) → models (tables). Each layer has one job and a "must not" list.
- One `commit()` per service call, so data and audit never disagree.
- Grow in four directions: **users** (workers + pooling + replica), **facilities**
  (add a `facility_id` tenant column + row-level scoping), **modules** (new
  services, same pattern), **data** (indexes, partitioning of `audit_logs` by time,
  archival).
- `audit_logs` is append-only and the fastest-growing table — plan partitioning and
  cold storage.

---

## 12. Testing & debugging

- **Backend:** `pytest -q` → auth, permissions, patients, business rules, the full
  six-step workflow, and audit. Runs against real PostgreSQL (`TEST_DATABASE_URL`,
  wiped each test).
- **Frontend:** `npm run typecheck` (tsc), `npm run lint`, `npm run format`. There is
  **no frontend test suite yet** — be honest, and say the next step is
  Testing Library for the forms/guards and Playwright for the six-stage journey.
- **Live debugging script:** reproduce → read the `request_id` → find it in the
  logs → identify the layer (401/403 = authz, 409 = conflict, 422 = validation) →
  query the table → fix at the right layer → add a regression test.

---

## 13. Scoring self-assessment (be ready to say this)

| Area | Weight | Where you stand |
| --- | --- | --- |
| Backend/API & business logic | 15% | Strong — layered, tested services |
| Database modelling & integrity | 15% | Strong — constraints + partial indexes + locking |
| Security & authorization | 15% | Strong — server-side RBAC, rotating refresh, hashed creds |
| Healthcare workflow correctness | 10% | Strong — the full journey with real rules |
| Frontend & usability | 10% | Good — worklists, dashboard, validation, a11y-ish |
| Testing & debugging | 10% | Backend strong; **frontend tests are the gap** |
| Architecture & maintainability | 10% | Strong — documented layers, two repos |
| Deployment / operations | 5% | Design-level; be ready to describe |
| Auditability | 5% | Strong — append-only, old/new values |
| Communication & code defence | 5% | Practise §8 out loud |

**Traps the brief warns about — and your answer:**

- *"A polished downloaded EMR doesn't earn marks."* → You built it (with AI
  assistance you disclose); you can defend every line.
- *"The panel may test restricted API access directly."* → Be ready to `curl` an
  admin-only endpoint as `nurse` and show the `403` live.
- *"A serious weakness may outweigh a high score."* → Pre-empt it: name your own
  gaps (§13) before they do, and give the plan.

---

## 14. AI disclosure (make this true in both READMEs)

Both repositories were built with AI assistance and must say so. Use a statement
like:

> This project was designed to the GSI practical brief and **generated with AI
> assistance** from requirements I specified. No downloaded EMR was used. Libraries
> are listed in each README. Written, changed, debugged and verified by me:
> _(list what you personally did — e.g. ran and fixed the demo journey, adjusted
> the schema, wrote the recycle-bin feature, fixed the theme runtime error)_.
> I have read and run the code and can explain every part.

Do not overstate ownership; the brief rewards honesty and understanding.

---

## 15. Handover (source control & continuity)

- Two public repos: `emr-frontend` (`main`) and `emr-api` (`master`), each with a
  real README: setup, architecture, environment, run, tests, limitations.
- A scripted end-to-end check (`python scripts/demo_journey.py`) proves the system
  works without clicking.
- An AI-assistance disclosure a new maintainer can trust.
- Another developer can: clone → `pip install -r requirements-dev.txt` →
  `flask db upgrade && flask seed-demo` → `flask run`; and clone → `npm install` →
  `npm run dev`. Migrations, tests and docs are in-repo.

---

## 16. The night-before rehearsal (do this)

1. Run the whole six-stage journey **twice** without notes; every 409/422/403 live.
2. Do **one** live change end to end (pick "multiple surgeons") in < 20 minutes.
3. Recite §8 answers out loud, pointing at the files.
4. Confirm both repos are pushed and the disclosure is filled in.
5. Have `docs/OFFLINE_TROUBLESHOOTING.md` open in case the local API is down.
