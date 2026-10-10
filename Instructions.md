

content = r'''# EMR Frontend Blueprint
## Next.js App Router + JavaScript JSX + shadcn/ui + TanStack Data Tables + Flask API

**Project:** Electronic Medical Record (EMR) frontend  
**Backend:** Existing Flask JSON API + PostgreSQL  
**UI direction:** Professional clinical workspace with orange as the primary accent  
**Implementation style:** Feature-based folders, reusable UI, centralized API services, server-enforced permissions

---

## 1. Product goal

Build a clear, fast, role-aware frontend for the existing EMR patient journey:

1. Patient registration and search
2. Consultation / encounter documentation
3. Diagnoses
4. Ward, bed and admission management
5. Surgery scheduling and workflow
6. Discharge
7. Follow-up appointments
8. Worklists and dashboard
9. User and ward/bed administration
10. Audit-log review

The frontend is a client for the existing Flask API. It must **not** recreate clinical business rules in the browser or connect directly to PostgreSQL. Flask remains the authority for validation, workflow transitions, audit logging, and permissions.

### Important scope boundaries

The current backend does not include laboratory, pharmacy, billing, insurance, file uploads, multi-facility tenancy, MFA, or HL7/FHIR endpoints. Do not add these as functional screens unless the backend is extended. A future-facing navigation placeholder may be used only if it is clearly marked “Not available”.

---

## 2. Recommended stack

- **Next.js App Router** with JavaScript (`.js` / `.jsx`), not TypeScript.
- **shadcn/ui** components copied into the project and customized locally.
- **Tailwind CSS** for layout and styling.
- **TanStack Table** for sortable, filterable, paginated data tables.
- **React Hook Form + Zod** for client-side form state and user-friendly validation. Flask remains authoritative.
- **Lucide React** icons.
- **Sonner** for toast notifications.
- **Recharts** only for simple dashboard charts if the dashboard endpoint provides suitable data.
- **date-fns** for date formatting.
- **Native `fetch`** behind a centralized service layer.
- Optional: **SWR** or **TanStack Query** if the application needs caching, request deduplication, and automatic revalidation. Pick one rather than adding both.

Use the shadcn template patterns as starting points:
- `dashboard-01`: authenticated application shell, sidebar, header, navigation, content area, responsive dashboard layout.
- `login-01`: clean sign-in page layout and form composition.
- `signup-01`: use as a visual/form pattern only if a public self-registration flow is deliberately added. The current API describes admin-created users, not public sign-up, so do **not** expose open account registration by default.

Template names are references for layout patterns, not dependencies that replace the project’s actual page architecture. Adapt them to the EMR workflow and access rules.

---

## 3. Visual design system

### Orange palette

Use orange as a focused accent for primary actions and active navigation, not as a background for every panel.

Suggested tokens:
- Primary: `#EA580C` (orange-600)
- Hover: `#C2410C` (orange-700)
- Soft accent background: `#FFF7ED` (orange-50)
- Accent border: `#FED7AA` (orange-200)
- Main text: `#171717`
- Muted text: `#737373`
- Page background: `#FAFAFA`
- Surface/card: `#FFFFFF`
- Border: `#E5E5E5`
- Destructive: use the shadcn destructive token, not orange
- Success / warning / error: use distinct semantic colors; never communicate status by color alone

Use CSS variables compatible with shadcn’s theme tokens. Keep the interface calm and high contrast. In clinical tables, prioritize readability over decoration.

### UI rules

- Use `dashboard-01` as the base shell: collapsible sidebar, top header, breadcrumbs/page title, content region.
- Keep page titles, one-sentence descriptions, and primary actions consistent.
- Use cards for summary metrics and grouped forms, not around every individual field.
- Tables should support loading, empty, error, and populated states.
- Use confirmation dialogs for destructive or irreversible actions.
- Use a reason field for soft-delete/cancel actions where the API requires one.
- Never rely on orange, green, or red alone to communicate a status; pair status text with a badge/icon.
- Use clear labels, inline validation, and keyboard-accessible dialogs and menus.
- Make layouts responsive for desktop, tablet, and small laptop screens. Dense clinical tables may use horizontal scrolling on mobile.
- Use fictional patient data in development and screenshots.

### Suggested typography and spacing

- Font: Inter or the default shadcn font stack.
- Page title: `text-2xl font-semibold tracking-tight`.
- Section title: `text-base font-semibold`.
- Supporting text: `text-sm text-muted-foreground`.
- Standard content gap: `gap-4` or `gap-6`.
- Form width: full width on small screens; constrain long forms on wide screens.
- Avoid very small table text. Clinical information should remain comfortably readable.

---

## 4. Feature-based folder structure

Use a feature-first structure. Shared components stay in `components/`; feature-specific UI, schemas, hooks, and table definitions live inside their feature. All Flask communication goes through `services/`.

```text
emr-frontend/
├── public/
│   ├── logo.svg
│   └── images/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── login/
│   │   │   │   └── page.jsx
│   │   │   └── unauthorized/
│   │   │       └── page.jsx
│   │   ├── (app)/
│   │   │   ├── layout.jsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.jsx
│   │   │   ├── patients/
│   │   │   │   ├── page.jsx
│   │   │   │   ├── new/page.jsx
│   │   │   │   └── [patientId]/
│   │   │   │       ├── page.jsx
│   │   │   │       ├── edit/page.jsx
│   │   │   │       ├── timeline/page.jsx
│   │   │   │       └── encounters/new/page.jsx
│   │   │   ├── encounters/
│   │   │   │   ├── page.jsx
│   │   │   │   └── [encounterId]/page.jsx
│   │   │   ├── admissions/
│   │   │   │   ├── page.jsx
│   │   │   │   ├── new/page.jsx
│   │   │   │   └── [admissionId]/page.jsx
│   │   │   ├── wards/page.jsx
│   │   │   ├── surgeries/
│   │   │   │   ├── page.jsx
│   │   │   │   ├── new/page.jsx
│   │   │   │   └── [surgeryId]/page.jsx
│   │   │   ├── follow-ups/page.jsx
│   │   │   ├── worklists/
│   │   │   │   ├── inpatients/page.jsx
│   │   │   │   ├── surgeries/page.jsx
│   │   │   │   └── follow-ups/page.jsx
│   │   │   ├── users/
│   │   │   │   ├── page.jsx
│   │   │   │   ├── new/page.jsx
│   │   │   │   └── [userId]/page.jsx
│   │   │   └── audit-logs/page.jsx
│   │   ├── api/
│   │   │   └── auth/
│   │   │       ├── login/route.js
│   │   │       ├── refresh/route.js
│   │   │       ├── logout/route.js
│   │   │       └── me/route.js
│   │   ├── layout.jsx
│   │   ├── globals.css
│   │   └── not-found.jsx
│   ├── components/
│   │   ├── app-shell/
│   │   │   ├── app-sidebar.jsx
│   │   │   ├── app-header.jsx
│   │   │   ├── app-breadcrumbs.jsx
│   │   │   └── nav-items.js
│   │   ├── data-table/
│   │   │   ├── data-table.jsx
│   │   │   ├── data-table-toolbar.jsx
│   │   │   ├── data-table-pagination.jsx
│   │   │   └── data-table-column-header.jsx
│   │   ├── forms/
│   │   │   ├── form-field.jsx
│   │   │   └── form-error.jsx
│   │   ├── shared/
│   │   │   ├── confirm-dialog.jsx
│   │   │   ├── page-header.jsx
│   │   │   ├── loading-state.jsx
│   │   │   ├── empty-state.jsx
│   │   │   ├── error-state.jsx
│   │   │   ├── status-badge.jsx
│   │   │   └── permission-gate.jsx
│   │   └── ui/                 # shadcn components
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/login-form.jsx
│   │   │   ├── schemas/login-schema.js
│   │   │   └── hooks/use-current-user.js
│   │   ├── dashboard/
│   │   │   ├── components/metric-card.jsx
│   │   │   ├── components/recent-activity.jsx
│   │   │   └── hooks/use-dashboard.js
│   │   ├── patients/
│   │   │   ├── components/patients-table.jsx
│   │   │   ├── components/patient-form.jsx
│   │   │   ├── components/patient-summary.jsx
│   │   │   ├── components/patient-timeline.jsx
│   │   │   ├── columns/patient-columns.jsx
│   │   │   ├── schemas/patient-schema.js
│   │   │   └── hooks/use-patients.js
│   │   ├── encounters/
│   │   │   ├── components/encounters-table.jsx
│   │   │   ├── components/encounter-form.jsx
│   │   │   ├── components/diagnosis-form.jsx
│   │   │   ├── columns/encounter-columns.jsx
│   │   │   ├── schemas/encounter-schema.js
│   │   │   └── hooks/use-encounters.js
│   │   ├── admissions/
│   │   │   ├── components/admissions-table.jsx
│   │   │   ├── components/admission-form.jsx
│   │   │   ├── components/discharge-form.jsx
│   │   │   ├── columns/admission-columns.jsx
│   │   │   ├── schemas/admission-schema.js
│   │   │   └── hooks/use-admissions.js
│   │   ├── wards/
│   │   │   ├── components/wards-list.jsx
│   │   │   ├── components/bed-occupancy.jsx
│   │   │   └── schemas/ward-schema.js
│   │   ├── surgeries/
│   │   │   ├── components/surgeries-table.jsx
│   │   │   ├── components/surgery-form.jsx
│   │   │   ├── components/surgery-actions.jsx
│   │   │   ├── columns/surgery-columns.jsx
│   │   │   ├── schemas/surgery-schema.js
│   │   │   └── hooks/use-surgeries.js
│   │   ├── follow-ups/
│   │   │   ├── components/followups-table.jsx
│   │   │   ├── components/followup-form.jsx
│   │   │   ├── columns/followup-columns.jsx
│   │   │   ├── schemas/followup-schema.js
│   │   │   └── hooks/use-followups.js
│   │   ├── worklists/
│   │   │   ├── components/inpatients-table.jsx
│   │   │   ├── components/today-surgeries-table.jsx
│   │   │   └── components/followups-due-table.jsx
│   │   ├── users/
│   │   │   ├── components/users-table.jsx
│   │   │   ├── components/user-form.jsx
│   │   │   ├── components/reset-password-dialog.jsx
│   │   │   ├── columns/user-columns.jsx
│   │   │   └── schemas/user-schema.js
│   │   └── audit/
│   │       ├── components/audit-table.jsx
│   │       ├── components/audit-filters.jsx
│   │       └── columns/audit-columns.jsx
│   ├── services/
│   │   ├── http/
│   │   │   ├── api-client.js
│   │   │   ├── api-error.js
│   │   │   └── endpoints.js
│   │   ├── auth/
│   │   │   └── auth-service.js
│   │   ├── patients/
│   │   │   └── patient-service.js
│   │   ├── encounters/
│   │   │   └── encounter-service.js
│   │   ├── admissions/
│   │   │   └── admission-service.js
│   │   ├── wards/
│   │   │   └── ward-service.js
│   │   ├── surgeries/
│   │   │   └── surgery-service.js
│   │   ├── follow-ups/
│   │   │   └── followup-service.js
│   │   ├── dashboard/
│   │   │   └── dashboard-service.js
│   │   ├── users/
│   │   │   └── user-service.js
│   │   ├── audit/
│   │   │   └── audit-service.js
│   │   └── worklists/
│   │       └── worklist-service.js
│   ├── lib/
│   │   ├── utils.js
│   │   ├── env.js
│   │   ├── date.js
│   │   ├── permissions.js
│   │   └── formatters.js
│   └── middleware.js
├── .env.example
├── components.json
├── jsconfig.json
├── package.json
└── README.md
```

### Folder responsibilities

- `app/`: URL routing, layouts, loading/error boundaries, and thin route pages. Pages compose feature components; they should not contain large forms or raw `fetch` calls.
- `features/`: all UI and client behavior belonging to a business capability. Keep a feature’s forms, columns, schemas, and hooks together.
- `services/`: the only normal place for frontend-to-API calls. It owns endpoint paths, HTTP details, request parameters, and response extraction—not clinical rules.
- `components/ui/`: shadcn primitives such as Button, Input, Select, Dialog, Sheet, Table, Badge, Calendar, Form, Skeleton, and Dropdown Menu.
- `components/data-table/`: reusable TanStack Table rendering and pagination controls.
- `components/app-shell/`: sidebar, header, navigation, user menu, breadcrumbs.
- `lib/`: small cross-cutting helpers and formatters.
- `app/api/auth/`: Next.js route handlers that act as a same-origin boundary for login/refresh/logout/me and set secure cookies.

Avoid creating a generic `utils/` folder full of unrelated code. Keep business-specific code in its feature.

---

## 5. Page map and detailed page requirements

### 5.1 Login — `/login`

**Template reference:** `login-01`

**Purpose:** Sign in existing staff accounts. Public account registration is not enabled by default because the backend says administrators create users.

**Layout**
- Compact centered panel or split layout with EMR logo/name.
- Short supporting line such as “Sign in to your clinical workspace”.
- Username and password fields.
- Password visibility toggle.
- Submit button with loading state.
- Inline invalid-credentials message.
- Link to help/contact support only if the organisation provides a real support route.
- Avoid a “Create account” link unless a real registration workflow is implemented.

**Fields**
- `username` — required
- `password` — required

**Behavior**
- Submit to `POST /api/v1/auth/login` through the Next.js `/api/auth/login` route handler.
- On success, keep the access token in server-controlled/session memory strategy and set the refresh token in a secure, HTTP-only cookie.
- Redirect to `/dashboard` or the user’s intended route.
- Do not expose raw tokens to client-side JavaScript.
- Show generic login failure messages; do not reveal whether a username exists.

### 5.2 Dashboard — `/dashboard`

**Template reference:** `dashboard-01`

**Purpose:** Role-aware overview of today’s operational work.

**Header**
- “Dashboard”
- Date in Africa/Kampala timezone
- Optional “Refresh” action

**Summary cards**
- Counts returned by `GET /api/v1/dashboard`
- Inpatients
- Surgeries today
- Follow-ups due
- Any other count actually returned by the API

Do not invent counts or assume the API provides metrics it does not return. Start with the real response shape, then map it to cards.

**Work panels**
- Today’s surgeries (when permitted)
- Inpatients needing attention
- Follow-ups due
- Recent activity only if there is a supported endpoint; do not infer it from audit data unless the endpoint is authorized and appropriate.

**States**
- Skeleton cards while loading
- Empty state for no work
- Error state with retry
- Permission-aware links and panels

### 5.3 Patients list — `/patients`

**Purpose:** Search and manage the patient register.

**Top area**
- Page title: Patients
- Description: search by name, MRN, national ID, or phone
- “Register patient” primary orange button (only for users with create permission)

**Search and filters**
- Search input mapped to `GET /api/v1/patients?q=...`
- Optional sex filter only if supported by the backend
- Pagination parameters `page` and `per_page`; never download all records just to paginate locally.

**Data table columns**
- MRN
- Patient name
- Sex
- Date of birth / age display (calculate age carefully from date of birth; do not store derived age)
- Phone
- National ID, if present and permitted
- Updated/created date if returned
- Actions: View; Edit if permitted; Delete/Archive only for authorized admin

**Table features**
- Server-side pagination and search
- Sorting only for fields the API supports; otherwise sort the current page only when this is clearly communicated.
- Row click should not conflict with checkbox/action controls.
- Export is not in scope unless a backend export or an explicitly approved client-side export is added.

**Register patient form — `/patients/new`**
- First name (required)
- Last name (required)
- Sex: `MALE`, `FEMALE`, `OTHER`
- Date of birth (required)
- National ID (optional)
- Phone (optional)
- Address (optional)
- Next of kin name (optional)
- Next of kin phone (optional)

**Form behavior**
- Use labels, inline errors, and a clear required-fields indicator.
- Validate format for user feedback, but trust Flask for final validation.
- Warn on likely duplicates if the API returns a `409 DUPLICATE_PATIENT`; show the existing patient ID/link only if the backend response includes it and the user is allowed to view it.
- After create, show the generated MRN and link to the patient profile.
- Do not silently retry a create request after an ambiguous network failure.

**Patient detail — `/patients/[patientId]`**
- Patient identity header: name, MRN, sex, date of birth, phone.
- Action buttons depend on permission: Edit, New encounter, Timeline.
- Tabs or sections: Overview, Timeline, Encounters, Admissions, Follow-ups.
- Load only data the API returns and the user is permitted to access.
- Do not display clinical details to an administrator merely because the administrator can manage accounts; the backend’s role matrix intentionally restricts clinical access.

**Edit patient — `/patients/[patientId]/edit`**
- Same fields as registration, prefilled.
- Use `PATCH /api/v1/patients/{id}`.
- If a version field is returned and stale-write detection is supported, send it as documented by the API and handle `409` conflict.
- Never offer hard-delete functionality.

**Patient timeline — `/patients/[patientId]/timeline`**
- Chronological timeline from `GET /api/v1/patients/{id}/timeline`.
- Event types: encounter, diagnosis, admission, discharge, surgery, follow-up.
- Clearly label dates, statuses, and clinicians where returned.
- Keep sensitive information hidden unless the current user is authorized to read it.

### 5.4 Encounters and consultation — `/encounters`

**Purpose:** Review consultation records and open encounters.

**Table columns**
- Encounter ID
- Patient / MRN
- Encounter type (`OPD`, `EMERGENCY`)
- Clinician
- Encounter date
- Status
- Chief complaint
- Actions: Open / Continue

**Encounter form**
- Patient (required; select from searchable patient lookup)
- Clinician (required when creating as a nurse; otherwise use backend default if supported)
- Encounter type: `OPD`, `EMERGENCY`
- Chief complaint / symptoms (required as appropriate)
- Clinical notes

**Encounter detail**
- Patient summary
- Encounter status and date
- Chief complaint and notes
- Diagnoses list
- Add diagnosis action for `DOCTOR` and `SURGEON`
- Close encounter action only for `DOCTOR` / `SURGEON`, with clear explanation that a diagnosis is required first.
- Closed encounters should appear read-only because the backend locks them.

**Diagnosis form**
- Description (required)
- ICD-10 code (optional)
- Diagnosis type: `PRIMARY`, `SECONDARY`
- Certainty: `PROVISIONAL`, `CONFIRMED`

**Rules to communicate in the UI**
- Only one primary diagnosis per encounter.
- A closed encounter cannot be edited.
- A failed rule should show the API’s useful message, not a generic “Something went wrong”.

### 5.5 Admissions — `/admissions`

**Purpose:** View admissions, admit eligible patients, and discharge them.

**Table columns**
- Admission ID
- Patient / MRN
- Ward
- Bed
- Admitting doctor
- Admission date/time
- Status (`ADMITTED`, `DISCHARGED`, or exact backend values)
- Actions: View; Discharge when allowed

**Admission form**
- Patient (required)
- Encounter (required and must belong to selected patient)
- Ward (lookup)
- Available bed (lookup based on ward occupancy)
- Reason (required)
- Admitting doctor (optional if backend defaults to encounter clinician)

**Behavior**
- Use `GET /api/v1/wards` to show wards and beds with occupancy.
- Never imply a bed is guaranteed available based only on a stale frontend response.
- If the API returns `409 BED_OCCUPIED` or `409 ALREADY_ADMITTED`, explain the conflict and ask the user to refresh/reselect.
- The backend enforces one active admission per patient and per bed.

**Discharge form/dialog**
- Condition at discharge:
  - `RECOVERED`
  - `IMPROVED`
  - `UNCHANGED`
  - `TRANSFERRED`
  - `LEFT_AGAINST_ADVICE`
  - `DECEASED`
- Summary (required)
- Instructions (optional)

**Discharge safeguards**
- Confirm patient identity before submitting.
- Explain that the discharge record is preserved and not editable.
- If a surgery is scheduled or in progress, display the backend error and do not offer a frontend bypass.
- The backend frees the bed by deriving occupancy from active admissions.

### 5.6 Wards and beds — `/wards`

**Purpose:** Admin manages wards and beds; clinical roles can read wards as permitted.

**Page layout**
- Ward list or cards with ward name/code.
- Expand a ward to show its beds.
- Each bed has a readable state such as Available / Occupied / Out of service based on API fields.
- Use both status text and a badge/icon.
- Admin-only controls: create ward, add bed, deactivate/reactivate if the backend supports the operation.

**Forms**
- Ward: code and name (match the API schema exactly).
- Bed: bed number and any required ward fields.
- Do not show edit/deactivate actions until a matching API endpoint exists. Current documented endpoints include `GET/POST /wards` and `POST /wards/{id}/beds`.

### 5.7 Surgeries — `/surgeries`

**Purpose:** Schedule and track surgery workflow.

**Table columns**
- Surgery ID
- Patient / MRN
- Procedure
- Lead surgeon
- Theatre
- Scheduled start and end
- Status (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
- Actions appropriate to state and role

**Schedule surgery form**
- Patient (required)
- Admission (required; must belong to patient and be active)
- Procedure name (required)
- Procedure code (optional)
- Lead surgeon (required)
- Theatre (required)
- Scheduled start (required)
- Scheduled end (required; must be after start)

**Workflow actions**
- Start: `POST /surgeries/{id}/start`
- Complete: `POST /surgeries/{id}/complete`, with outcome notes
- Cancel: `POST /surgeries/{id}/cancel`, with reason
- Update: `PATCH /surgeries/{id}` only while scheduled

**Safeguards**
- Only the lead surgeon may start or complete.
- Show a confirmation dialog before cancellation.
- Display conflicts such as `THEATRE_BOOKED` or `SURGEON_BUSY`.
- Do not let the UI make a cancelled or completed surgery editable.
- Status transition: `SCHEDULED → IN_PROGRESS → COMPLETED`, or `SCHEDULED → CANCELLED`.

### 5.8 Follow-ups — `/follow-ups`

**Purpose:** Book and manage patient follow-up appointments.

**Table columns**
- Follow-up ID
- Patient / MRN
- Scheduled date/time
- Reason
- Clinician
- Linked admission, if any
- Status
- Actions

**Form**
- Patient (required)
- Scheduled date/time (required and in the future)
- Reason (required)
- Admission (optional)
- Clinician (optional)

**Status actions**
- Complete
- Cancel (reason required)
- Mark missed
- Reschedule only while scheduled

Use `GET /api/v1/worklists/followups` for the due-worklist and `GET/POST /api/v1/followups` for general follow-up management. Map the query parameters to the documented API exactly.

### 5.9 Worklists

**Inpatients — `/worklists/inpatients`**
- Patient / MRN, ward, bed, admission time, admitting doctor
- Read from `GET /api/v1/worklists/inpatients`
- Link to patient/admission details according to permissions

**Today’s surgeries — `/worklists/surgeries`**
- Date selector defaults to today in `Africa/Kampala`
- Read from `GET /api/v1/worklists/surgeries?day=YYYY-MM-DD`
- Schedule and status badges
- Read-only for roles that cannot manage surgery

**Follow-ups due — `/worklists/follow-ups`**
- Date range filter
- Read from `GET /api/v1/worklists/followups?date_from=...&date_to=...`
- Display upcoming, due, completed, cancelled, and missed states according to the response.

### 5.10 Users — `/users`

**Purpose:** Admin-only staff account management.

**Table columns**
- Full name
- Username
- Email
- Role
- Active / inactive
- Created date, if returned
- Actions: View/Edit, deactivate (soft delete if API uses DELETE), reset password

**Create user form**
- Username
- Email
- Full name
- Role: `ADMIN`, `REGISTRAR`, `NURSE`, `DOCTOR`, `SURGEON`
- Password / initial password fields as supported by the backend

**Actions**
- Update user with `PATCH /api/v1/users/{id}` only for supported fields.
- Reset password with `POST /api/v1/users/{id}/reset-password`.
- `DELETE /api/v1/users/{id}` requires a reason and is a safe-delete operation.
- Never allow an admin to deactivate/delete their own account.
- Make it clear that changing a role affects access immediately.

### 5.11 Audit logs — `/audit-logs`

**Purpose:** Admin-only, read-only traceability.

**Filters**
- Entity type
- Entity ID
- User
- Patient ID
- Action
- Start and end date/time

**Table columns**
- Timestamp
- Username
- Action
- Entity type / ID
- Patient ID, when present
- Request ID
- IP address, if returned
- Reason, if returned
- Expandable old/new value detail

**Behavior**
- Use `GET /api/v1/audit-logs` with documented filters.
- Read-only: no create/edit/delete buttons.
- Display timestamps in Africa/Kampala while retaining the original ISO timestamp in details if useful.
- Avoid dumping entire clinical records into the table by default. Use a detail drawer and show only the authorized fields.

---

## 6. Role-aware navigation and screen access

The five roles are:

| Role | Main navigation / capabilities |
|---|---|
| `ADMIN` | Dashboard, patients (limited by backend permission), wards, users, audit logs, worklists |
| `REGISTRAR` | Dashboard, patients, follow-ups, worklists |
| `NURSE` | Dashboard, patients/search, encounters/triage, admissions, wards, worklists, timeline |
| `DOCTOR` | Dashboard, patients, encounters/diagnoses, admissions/discharge, follow-ups, wards, worklists, timeline |
| `SURGEON` | Doctor capabilities plus surgery scheduling and transitions |

**Critical nuance:** The backend permission matrix is the source of truth. For example, an admin can manage users and audit logs but is intentionally not given clinical record access. Do not blindly make all patient or clinical pages visible to every role.

Create `lib/permissions.js` for convenience helpers such as `can(user, "patient:create")`, but use it only to hide/show controls and improve navigation. Flask must still reject unauthorized requests. On `403`, show an access-denied state and do not attempt to bypass the backend.

---

## 7. Data table standard

Use TanStack Table through a reusable component, but prefer **server-side pagination and filtering** because the API returns a `data` payload and `meta` pagination object.

### Every table should support

- Column definitions stored under the feature’s `columns/` folder
- Loading skeleton
- Empty state with a useful next action
- Error state with retry
- Search/filter controls supported by the API
- Pagination showing current page, page size, total records, and total pages
- Accessible row actions in a dropdown
- Responsive overflow
- Status badges with text labels
- Correct handling of `meta.page`, `meta.per_page`, `meta.total`, and `meta.pages`

### Suggested shared table props

```jsx
<DataTable
  columns={columns}
  data={rows}
  page={page}
  pageSize={pageSize}
  total={meta.total}
  pageCount={meta.pages}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
  loading={isLoading}
/>
```

This is an illustrative component contract; adapt it to the actual shared component you implement.

### Avoid

- Fetching every patient and paginating only in the browser
- Assuming every endpoint supports arbitrary sorting
- Treating an HTTP `200` response as proof that `data` is an array without checking the API contract
- Showing actions that are not supported by the backend
- Using the same table component to hide important workflow differences between clinical modules

---

## 8. Flask API integration architecture

### Environment variables

`.env.local` example:

```env
# Server-side only. Do not prefix this with NEXT_PUBLIC.
FLASK_API_BASE_URL=http://localhost:5000
# Optional public URL only if the browser truly calls Flask directly (not recommended).
# NEXT_PUBLIC_APP_NAME=EMR
```

Use `FLASK_API_BASE_URL` in server-side service and route-handler code. Do not expose internal API URLs, credentials, or tokens to the browser.

### API endpoint map

The API base path is `/api/v1`.

| Feature | Method and endpoint |
|---|---|
| Health | `GET /health` |
| Login | `POST /auth/login` |
| Refresh | `POST /auth/refresh` |
| Logout | `POST /auth/logout` |
| Current user | `GET /auth/me` |
| Dashboard | `GET /dashboard` |
| Users | `GET/POST /users`, `GET/PATCH/DELETE /users/{id}` |
| Reset password | `POST /users/{id}/reset-password` |
| Patients | `GET/POST /patients`, `GET/PATCH/DELETE /patients/{id}` |
| Patient timeline | `GET /patients/{id}/timeline` |
| Encounters | `GET/POST /encounters`, `GET/PATCH /encounters/{id}` |
| Close encounter | `POST /encounters/{id}/close` |
| Diagnoses | `POST /encounters/{id}/diagnoses`, `PATCH/DELETE /diagnoses/{id}` |
| Wards | `GET/POST /wards`, `POST /wards/{id}/beds` |
| Admissions | `GET/POST /admissions`, `GET /admissions/{id}` |
| Discharge | `POST /admissions/{id}/discharge` |
| Surgeries | `GET/POST /surgeries`, `GET/PATCH /surgeries/{id}` |
| Surgery transitions | `POST /surgeries/{id}/start`, `/complete`, `/cancel` |
| Follow-ups | `GET/POST /followups`, `GET/PATCH /followups/{id}` |
| Follow-up status | `POST /followups/{id}/status` |
| Inpatient worklist | `GET /worklists/inpatients` |
| Surgery worklist | `GET /worklists/surgeries?day=YYYY-MM-DD` |
| Follow-up worklist | `GET /worklists/followups?date_from=...&date_to=...` |
| Audit logs | `GET /audit-logs` |

Confirm each endpoint’s exact payload and response against the Flask schemas and tests before wiring the form. The table is based on the documented API reference, not a substitute for inspecting the actual code.

### API response contract

Success responses are documented in this general form:

```json
{
  "data": {},
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 1,
    "pages": 1
  }
}
```

Error responses:

```json
{
  "error": {
    "code": "DUPLICATE_PATIENT",
    "message": "A readable error message",
    "details": {},
    "request_id": "request-id"
  }
}
```

Do not assume `meta` is present for single-record responses. Normalize errors in one place and show `error.message` to users where safe. Keep `request_id` available for support diagnostics.

---

## 9. Authentication and token handling

The backend uses short-lived JWT access tokens (documented as 15 minutes) and rotating refresh tokens (documented as 7 days).

### Recommended browser-safe design

1. The login form posts to a same-origin Next.js route handler: `/api/auth/login`.
2. The route handler calls Flask `POST /api/v1/auth/login`.
3. It stores the refresh token in an `httpOnly`, `Secure` in production, `SameSite=Lax` cookie.
4. Keep the access token in server-managed memory or another deliberately designed server-side session approach; do not put access or refresh tokens in `localStorage`.
5. On an expired access token, the server-side API boundary calls `/auth/refresh`, rotates the refresh token, updates the cookie, and retries the original request once.
6. Logout calls Flask `/auth/logout` with the refresh token and clears the cookie.
7. Current-user loading calls `/auth/me` with the access token.
8. Protect authenticated routes on the server where practical. Middleware may provide a redirect based on cookie presence, but it cannot replace Flask permission checks.

**Implementation caution:** A Next.js route handler cannot automatically share ordinary in-memory token state across unrelated requests or serverless instances. Implement a deliberate session/token strategy for the deployment target. For a robust design, use an encrypted server-side session store or a carefully designed BFF that can refresh tokens per request. Do not copy a browser-only `let accessToken` example into production and assume it is shared globally.

If you choose direct browser-to-Flask calls instead, you must configure CORS correctly and accept that tokens are exposed to the browser runtime. The preferred approach for this clinical application is a same-origin Backend-for-Frontend (BFF) boundary.

### Authorization

- Use role/permission helpers to control navigation and actions.
- Handle `401` by refreshing once or redirecting to login.
- Handle `403` with an access-denied message.
- Handle `409` with a conflict message and a refresh/retry path when appropriate.
- Handle `422` by mapping field-level details to the matching form fields.
- Never treat frontend permission checks as security controls.

---

## 10. Service layer conventions

Feature services should expose intention-revealing functions. Components should not build URLs or call Flask directly.

Example `services/patients/patient-service.js`:

```js
import { apiRequest } from "@/services/http/api-client";

export const patientService = {
  list(params = {}) {
    const query = new URLSearchParams();

    if (params.q) query.set("q", params.q);
    if (params.page) query.set("page", String(params.page));
    if (params.per_page) query.set("per_page", String(params.per_page));

    const suffix = query.size ? `?${query.toString()}` : "";
    return apiRequest(`/patients${suffix}`);
  },

  getById(patientId) {
    return apiRequest(`/patients/${patientId}`);
  },

  create(payload) {
    return apiRequest("/patients", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update(patientId, payload) {
    return apiRequest(`/patients/${patientId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  remove(patientId, reason) {
    const query = new URLSearchParams({ reason });
    return apiRequest(`/patients/${patientId}?${query.toString()}`, {
      method: "DELETE",
    });
  },
};
```

**Important:** Verify how the Flask API expects a delete reason (query parameter, JSON body, or another format) before implementing `remove`. The API documentation says a reason is required but the exact request shape must be confirmed in the route/schema.

Example `services/http/api-error.js`:

```js
export class ApiError extends Error {
  constructor({ status, code, message, details, requestId }) {
    super(message || "The request could not be completed.");
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}
```

Example service rules:
- Return parsed, normalized JSON—not React elements.
- Do not show toasts from service files.
- Do not place clinical workflow logic in the service layer.
- Use `URLSearchParams` for query parameters.
- Never log tokens or full patient records to the browser console.
- Include `X-Request-ID` in support/debug information if supplied by Flask.
- Do not automatically retry non-idempotent `POST` requests after network errors unless an idempotency contract exists.

---

## 11. Form design and validation

### General form pattern

- Use shadcn `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`.
- Use React Hook Form and Zod for fast feedback.
- Match enum values and field names exactly to Flask schemas.
- Put server errors next to the relevant field when the API supplies field details.
- Disable submit while saving; prevent accidental double submission.
- Preserve safe user-entered values after validation errors.
- Show success feedback and navigate to the created/updated record.
- Confirm high-impact workflow transitions.
- Use date/time controls that produce the ISO format expected by Flask.
- Format displayed UTC timestamps in `Africa/Kampala`, while preserving the original timestamp for API requests.

### Validation boundary

Client validation is for usability, not authority. Flask must validate all submitted data again. In particular:
- Patient duplicate checks are server-side.
- Date-of-birth limits and name/phone rules must match backend schemas.
- A primary diagnosis uniqueness conflict must be handled from the API.
- Admission and bed conflicts must be handled from the API.
- Surgery overlaps and state transitions must be handled from the API.
- Follow-up scheduling rules must be handled from the API.
- A closed encounter remains locked on the server.

### Suggested form components

- `PatientForm`
- `EncounterForm`
- `DiagnosisForm`
- `AdmissionForm`
- `DischargeForm`
- `SurgeryForm`
- `FollowupForm`
- `UserForm`
- `ResetPasswordDialog`
- `ConfirmDialog`

Prefer one feature form component reused for create/edit modes when the fields and behavior genuinely match. Do not force unrelated workflows into one giant generic form.

---

## 12. Error, loading, empty and success states

Use a consistent pattern throughout the application.

| Situation | UI response |
|---|---|
| Initial fetch | Skeleton rows/cards |
| No records | Friendly empty state with relevant next action |
| Network unavailable | Error state with Retry |
| `400` / `422` validation | Inline field errors plus form-level message |
| `401` | Refresh once if appropriate; otherwise return to login |
| `403` | Access denied; do not retry repeatedly |
| `404` | Record not found or no longer available |
| `409` | Explain conflict and ask user to refresh/reselect where appropriate |
| `5xx` | Generic service error plus request ID for support |
| Successful create/update | Toast plus navigate or refresh affected data |
| Successful workflow transition | Refresh the record and relevant worklists |

Avoid showing raw stack traces or internal exception details to clinical staff.

---

## 13. Accessibility, privacy and safety

This is a clinical system; privacy and correctness take priority over visual effects.

- Keep patient data out of URL query strings except for identifiers/filter parameters the API requires.
- Do not put clinical data, tokens, or passwords in `localStorage`, analytics events, logs, or error tracking breadcrumbs.
- Do not cache sensitive clinical responses in shared browser storage.
- Use secure cookies and HTTPS in production.
- Keep `FLASK_API_BASE_URL` server-only.
- Do not put secrets in `NEXT_PUBLIC_*` variables.
- Mask sensitive values where full display is not necessary.
- Require explicit confirmation for patient soft-delete, surgery cancellation, and other consequential transitions.
- Show the exact patient name and MRN in confirmation dialogs.
- Never add an endpoint or UI shortcut that bypasses Flask permissions.
- Keep audit logs read-only in the frontend.
- Use fictional records for demos, screenshots, and test data.
- Apply organisation-approved access policies and Uganda’s Data Protection and Privacy Act, 2019 requirements before real patient use.
- Clinical use requires security review, usability testing, staff training, and operational approval; a frontend alone does not make the EMR production-ready.

---

## 14. Implementation sequence

Build in vertical slices so each feature works end to end.

### Phase 1 — Foundation
1. Create the Next.js project using JavaScript.
2. Install and configure shadcn/ui and Tailwind.
3. Add `dashboard-01` shell patterns and orange theme tokens.
4. Add the login layout based on `login-01`.
5. Set up environment variables and the server-side API boundary.
6. Implement API error normalization and current-user loading.
7. Add sidebar/navigation and permission-aware navigation.

### Phase 2 — Core patient journey
1. Patients list with server-side search/pagination.
2. Patient registration and edit.
3. Patient detail and timeline.
4. Encounter list/create/detail.
5. Diagnosis create/edit.
6. Close encounter.

### Phase 3 — Inpatient and surgery workflow
1. Wards and bed occupancy.
2. Admissions list and admission form.
3. Discharge dialog/form.
4. Surgery list and scheduling form.
5. Start/complete/cancel actions.
6. Conflict handling and workflow state badges.

### Phase 4 — Follow-ups and worklists
1. Follow-up list and form.
2. Follow-up status/reschedule actions.
3. Inpatient worklist.
4. Today’s surgery worklist.
5. Follow-ups due worklist.
6. Dashboard cards wired to the actual dashboard response.

### Phase 5 — Administration and hardening
1. User management and password reset.
2. Audit log filters/table/detail drawer.
3. Role-by-role UI review.
4. Loading, empty, error, and conflict-state review.
5. Keyboard and responsive testing.
6. Security review of cookies, session handling, and sensitive data exposure.
7. End-to-end tests for each role and the complete patient journey.

---

## 15. Suggested acceptance checklist

### Shell and design
- [ ] Orange is the primary accent, used sparingly and consistently.
- [ ] Sidebar works on desktop and collapses to a sheet on small screens.
- [ ] Every page has a consistent title, description, and primary action.
- [ ] All controls have accessible labels and focus states.

### API integration
- [ ] No React component calls Flask directly.
- [ ] All API calls go through `services/`.
- [ ] API base URL is server-only.
- [ ] Pagination uses API `meta` values.
- [ ] Errors are normalized and display request IDs where useful.
- [ ] No automatic duplicate `POST` retries.

### Authentication and permissions
- [ ] Login uses the Flask API through the Next.js auth route handler.
- [ ] Refresh token is in an HTTP-only cookie.
- [ ] Access/refresh tokens are not placed in localStorage.
- [ ] A `401` refreshes at most once per request before sign-out.
- [ ] Each role sees only the appropriate navigation and actions.
- [ ] The API remains the final authorization authority.

### Patient journey
- [ ] Register patient and display generated MRN.
- [ ] Search patients by supported fields.
- [ ] Create an encounter and diagnosis.
- [ ] Close an encounter only when allowed and valid.
- [ ] Admit a patient into an available bed.
- [ ] Schedule, start, complete, or cancel surgery according to role/state.
- [ ] Discharge an eligible admission.
- [ ] Schedule and manage follow-ups.
- [ ] Timeline shows the supported events in chronological order.

### Safety and usability
- [ ] All high-impact actions have confirmation.
- [ ] Empty/loading/error states exist on every data screen.
- [ ] Validation errors are mapped to fields where possible.
- [ ] Dates display in Africa/Kampala time.
- [ ] Clinical data is not written to browser storage or console logs.
- [ ] Only fictional patient data is used in development.

---

## 16. Suggested shadcn components to add

Start with only the components needed for the first vertical slice, then add more as the features arrive.

- `button`
- `input`
- `label`
- `card`
- `badge`
- `separator`
- `sheet`
- `sidebar` (if using the shadcn sidebar pattern)
- `dropdown-menu`
- `avatar`
- `breadcrumb`
- `table`
- `pagination`
- `select`
- `textarea`
- `checkbox`
- `calendar`
- `popover`
- `dialog`
- `alert-dialog`
- `form`
- `skeleton`
- `tooltip`
- `command` (useful for searchable patient/clinician pickers)
- `tabs`
- `sonner`

Do not install every component at once if the project is still small. Add them when a page needs them.

---

## 17. Final architecture principles

1. **Feature-first UI:** patients code belongs in `features/patients`; surgery code belongs in `features/surgeries`.
2. **Services centralize API calls:** pages and components do not build raw Flask requests.
3. **The BFF protects tokens:** use Next.js route handlers as the same-origin boundary for authentication and authenticated API calls.
4. **Flask owns business rules:** the UI improves usability but never bypasses validation, role checks, audit logging, or workflow transitions.
5. **Tables are server-driven:** use API pagination and supported filters for potentially large clinical datasets.
6. **Design for safe workflows:** confirm consequential actions, preserve history, and clearly show state.
7. **Build only supported functionality:** the frontend must reflect the backend’s real endpoints and limitations.
8. **Use `dashboard-01`, `login-01`, and `signup-01` as starting patterns:** adapt the templates to the clinical domain instead of shipping a generic SaaS dashboard unchanged.

This blueprint is intended to be the implementation specification for the frontend. Before coding each feature, verify the exact Flask request schema, response shape, and permission requirements in the backend source and tests.
'''

o