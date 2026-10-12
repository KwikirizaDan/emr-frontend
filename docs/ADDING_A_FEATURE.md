# Adding a New Feature (Laboratory / Inventory) — DB → API → Frontend

This guide walks one feature from an empty table to a working screen, **layer by layer**, naming
every file to create and the exact lines to edit in existing files. A second section covers how to
**edit** an existing feature.

The worked example is **Laboratory orders** (in the README's "out of scope on purpose" list, so it
is a genuine greenfield addition). Section 3 shows the same steps for **Inventory**.

> The reference implementation to copy is **follow-ups** — it is the smallest complete vertical
> slice (model → schema → service → route → page). Every rule below is already true of that module.

---

## 0. How the stack is wired

```
Next.js (app/, features/, services/)
   │  fetch("/api/lab-orders/...")           same origin, no tokens in the browser
   ▼
BFF proxy  app/api/[...path]/route.ts        ← catch-all: NO edit needed for new endpoints
   │  resolves encrypted session cookie, attaches Bearer token
   ▼
Flask API (app/routes → app/schemas → app/services → app/models)
   │
   ▼
PostgreSQL (Alembic migrations)
```

| Layer | Backend responsibility | Frontend responsibility |
|---|---|---|
| DB | Tables, CHECK constraints, indexes (`migrations/versions/`) | — |
| Model | `app/models/<domain>.py` | — |
| Validation | `app/schemas/<domain>.py` (pydantic) | `features/<domain>/schemas/` (zod, fast feedback only) |
| Rules | `app/services/<domain>_service.py` (+ audit) | — |
| HTTP | `app/routes/<domain>.py` | `services/<domain>/` (talks to the BFF) |
| AuthZ | `ROLE_PERMISSIONS` in `app/permissions.py` | mirror in `lib/permissions.ts` (UI only) |
| UI | — | `features/<domain>/components/`, pages in `app/(app)/` |

**Golden rule:** the browser never sees the Flask URL or a token. Every service call is a
same-origin `/api/...` call (`services/http/bff-client.ts`), so adding an endpoint needs **no
change to the proxy** — `app/api/[...path]/route.ts` forwards any path that is not `/auth/*`.

---

## 1. Feature map — create vs edit

### Backend (`emr-api/emr-api/`)

| # | Action | File | Notes |
|---|--------|------|-------|
| 1 | **CREATE** | `migrations/versions/0003_laboratory.py` | `revision = "0003"`, `down_revision = "0002"` |
| 2 | **CREATE** | `app/models/lab.py` | `LabOrder` model |
| 3 | **EDIT** | `app/models/__init__.py` | add import at line 6 (after followup) |
| 4 | **CREATE** | `app/schemas/labs.py` | Create/Update/Query/StatusChange schemas |
| 5 | **EDIT** | `app/schemas/paths.py` | add `LabOrderPath` after line 39 (after `FollowUpPath`) |
| 6 | **CREATE** | `app/services/lab_service.py` | business rules + audit |
| 7 | **CREATE** | `app/routes/labs.py` | blueprint + endpoints |
| 8 | **EDIT** | `app/routes/__init__.py` | line 1 import list, line 5 `_MODULES` tuple |
| 9 | **EDIT** | `app/permissions.py` | add `lab:*` permission strings (lines 25-64 region) |
| 10 | **CREATE** | `tests/test_labs.py` | happy path, permission denial, rule denial |

### Frontend (`emr-frontend/`)

| # | Action | File | Notes |
|---|--------|------|-------|
| 11 | **EDIT** | `services/http/api-types.ts` | add `LabOrder` type after line 242 (end of `FollowUp`) |
| 12 | **CREATE** | `services/labs/lab-service.ts` | CRUD via `getList/getOne/mutateOne` |
| 13 | **CREATE** | `features/labs/schemas/lab-schema.ts` | zod + payload mapper |
| 14 | **CREATE** | `features/labs/hooks/use-lab-orders.ts` | SWR hook |
| 15 | **CREATE** | `features/labs/components/lab-orders-table.tsx` | list + filter + gated create button |
| 16 | **CREATE** | `features/labs/components/lab-order-form.tsx` | create/edit form |
| 17 | **CREATE** | `features/labs/components/lab-order-detail.tsx` | detail + status actions |
| 18 | **CREATE** | `app/(app)/laboratory/page.tsx` | list route |
| 19 | **CREATE** | `app/(app)/laboratory/new/page.tsx` | create route |
| 20 | **CREATE** | `app/(app)/laboratory/[orderId]/page.tsx` | detail route |
| 21 | **EDIT** | `lib/permissions.ts` | add `labView/labCreate/labUpdate` to `PERMISSIONS` (line 57) and to role arrays (lines 67-142) |
| 22 | **EDIT** | `components/app-shell/nav-items.ts` | add icon import (lines 2-14) + nav entry (first section, after line 78) |

---

## 2. Worked example: Laboratory orders

Scenario: a doctor orders a lab test for a patient; a lab technician records the result; the order
moves `ORDERED → COLLECTED → RESULTED` (or `CANCELLED` with a reason). Results are clinical data,
so the audit trail must record them.

### Step 1 — Model first, migration second

Create the model **first** (Step 2 below), then generate the migration with:

```bash
cd C:\Users\DAN\Desktop\emr-api\emr-api
.\.venv\Scripts\python.exe -m flask db revision --autogenerate -m "add lab orders"
```

This inspects `app/models/lab.py` (via `app/models/__init__.py` import) and produces a new file
`migrations/versions/0003_lab_orders.py` with the `CREATE TABLE` and index statements. Review it —
`autogenerate` does not detect CHECK constraints, partial indexes, or custom functions, so you may
need to add those manually after generation (see the migration example below for the extras you'd
append). Then apply it:

```bash
.\.venv\Scripts\python.exe -m flask db upgrade
```

The generated file will look approximately like this (Alembic creates the boilerplate; the comments
show the lines you would add for the partial index and CHECK):

```python
"""add lab orders

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-12 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    # op.create_table(...)  -- autogenerated from the LabOrder model
    # op.create_index("ix_lab_orders_patient", ...)  -- autogenerated (patient_id index)
    # op.create_index("ix_lab_orders_status", ...)   -- autogenerated (status index)

    # ---- Add manually after reviewing the generated file ----
    # One open order per patient per test (partial unique index)
    op.create_index(
        "uniq_lab_orders_open_test",
        "lab_orders",
        ["patient_id", "test_code"],
        unique=True,
        postgresql_where=sa.text("status <> 'CANCELLED' AND deleted_at IS NULL"),
    )
    # Status CHECK is also usually omitted by autogenerate; add if missing:
    # op.create_check_constraint("ck_lab_orders_status", "lab_orders",
    #     "status IN ('ORDERED', 'COLLECTED', 'RESULTED', 'CANCELLED')")


def downgrade():
    op.drop_index("uniq_lab_orders_open_test", table_name="lab_orders")
    op.drop_index("ix_lab_orders_status", table_name="lab_orders")
    op.drop_index("ix_lab_orders_patient", table_name="lab_orders")
    op.drop_table("lab_orders")
```

**Why the manual extras?** `autogenerate` reliably produces columns, FKs, PKs, simple indexes, and
`nullable`/`default` — but it skips `CheckConstraint`, partial indexes, and `server_default`
expressions. The model's `__table_args__` CheckConstraint and the partial unique index must be
added by hand after the autogenerated scaffold appears.

### Step 2 — Model

**CREATE** `emr-api/emr-api/app/models/lab.py`

```python
"""Laboratory orders.

A lab order is a clinical record: it is ordered by a clinician, worked by the lab,
and never hard deleted. Copy the column conventions from app/models/followup.py.
"""
from app.extensions import db
# TimestampMixin  -> created_at / updated_at
# UserStampMixin  -> created_by_id / updated_by_id
# SoftDeleteMixin -> deleted_at / deleted_by_id / delete_reason + is_deleted
# SerializerMixin -> to_dict(), used by the routes for the JSON response
# utcnow()        -> timezone-aware UTC default for every timestamp column
from app.models.base import (
    SerializerMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UserStampMixin,
    utcnow,
)

# Mirrors the CHECK constraint in migration 0003. To add a status, add it here,
# in the migration's CHECK, and to the TRANSITIONS table in the service.
LAB_ORDER_STATUSES = ("ORDERED", "COLLECTED", "RESULTED", "CANCELLED")


class LabOrder(db.Model, TimestampMixin, UserStampMixin, SoftDeleteMixin, SerializerMixin):
    __tablename__ = "lab_orders"
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('ORDERED', 'COLLECTED', 'RESULTED', 'CANCELLED')",
            name="ck_lab_orders_status",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id = db.Column(db.Integer, db.ForeignKey("encounters.id"))
    ordered_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    test_code = db.Column(db.String(20), nullable=False)
    test_name = db.Column(db.String(120), nullable=False)
    # Free-text result filled in when the order is RESULTED.
    result_summary = db.Column(db.String(500))
    status = db.Column(db.String(20), nullable=False, default="ORDERED")
    # When the sample should be drawn (defaults to now); separate from ordered_at.
    scheduled_for = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    ordered_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    resulted_at = db.Column(db.DateTime(timezone=True))
    # Optimistic locking: SQLAlchemy compares this on UPDATE and raises
    # StaleDataError if another request changed the row first -> 409.
    version = db.Column(db.Integer, nullable=False)
    __mapper_args__ = {"version_id_col": version}
```

No extra import juggling is needed — `utcnow` comes from `app.models.base` with the mixins.

**EDIT** `emr-api/emr-api/app/models/__init__.py` — add the import so Alembic's autogenerate and
`db.create_all()` can see the table:

```python
from app.models.lab import LabOrder  # noqa: F401   <- add after line 5 (followup import)
```

### Step 3 — Validation schemas

**CREATE** `emr-api/emr-api/app/schemas/labs.py`

```python
"""Lab order schemas. Unknown fields are rejected (BaseSchema sets extra="forbid")."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import Field

from app.schemas.common import BaseSchema, PageQuery, UtcDatetime

# Every field the client may send on create. PATCH only accepts a subset.
class LabOrderCreate(BaseSchema):
    patient_id: int
    encounter_id: Optional[int] = None
    test_code: str = Field(min_length=2, max_length=20, pattern=r"^[A-Z0-9-]+$")
    test_name: str = Field(min_length=2, max_length=120)
    # Naive datetimes are treated as UTC by the UtcDatetime annotated type.
    scheduled_for: Optional[UtcDatetime] = None


class LabOrderUpdate(BaseSchema):
    # A RESULTED order is locked; only these two fields are ever editable.
    result_summary: Optional[str] = Field(default=None, max_length=500)


class LabOrderStatusChange(BaseSchema):
    status: Literal["COLLECTED", "RESULTED", "CANCELLED"]
    reason: Optional[str] = Field(default=None, max_length=255)


class LabOrderQuery(PageQuery):
    patient_id: Optional[int] = None
    status: Optional[Literal["ORDERED", "COLLECTED", "RESULTED", "CANCELLED"]] = None
    date_from: Optional[UtcDatetime] = None
    date_to: Optional[UtcDatetime] = None
```

**EDIT** `emr-api/emr-api/app/schemas/paths.py` — add after `FollowUpPath` (line 38-39) so the
Swagger UI renders `{order_id}`:

```python
class LabOrderPath(BaseModel):
    order_id: int
```

### Step 4 — Service (business rules + audit)

**CREATE** `emr-api/emr-api/app/services/lab_service.py`

```python
"""Laboratory orders.

Every function does its work AND writes its audit rows inside one transaction,
then commits once (see the pattern in app/services/followup_service.py).
"""
from app.errors import BusinessRuleError, Conflict
from app.extensions import db
from app.models.base import utcnow
from app.models.lab import LabOrder
from app.services import audit_service as audit
from app.services.base import (
    apply_changes, get_or_404, paginate, stamp_create, stamp_update,
)
from app.services.patient_service import get_patient

# Allowed status moves. A RESULTED or CANCELLED order is final.
TRANSITIONS = {
    "ORDERED": {"COLLECTED", "RESULTED", "CANCELLED"},
    "COLLECTED": {"RESULTED", "CANCELLED"},
    "RESULTED": set(),
    "CANCELLED": set(),
}


# Connected from app/routes/labs.py -> get_lab_order()
def get_lab_order(order_id):
    return get_or_404(LabOrder, order_id, "Lab order")


# Connected from app/routes/labs.py -> create()
def create_lab_order(actor, data):
    patient = get_patient(data.patient_id)
    if data.encounter_id is not None:
        from app.models.encounter import Encounter
        encounter = get_or_404(Encounter, data.encounter_id, "Encounter")
        if encounter.patient_id != patient.id:
            raise BusinessRuleError("The encounter belongs to a different patient")

    # Rule: one open order per patient per test (belt and braces; the partial
    # unique index in migration 0003 is the database's guarantee).
    open_order = LabOrder.query.filter(
        LabOrder.patient_id == patient.id,
        LabOrder.test_code == data.test_code,
        LabOrder.status != "CANCELLED",
    ).first()
    if open_order:
        raise Conflict(
            f"There is already an open order for {data.test_code}",
            code="LAB_ORDER_OPEN",
            details={"existing_order_id": open_order.id},
        )

    order = LabOrder(
        patient_id=patient.id,
        encounter_id=data.encounter_id,
        ordered_by_id=actor.id,
        test_code=data.test_code,
        test_name=data.test_name,
        scheduled_for=data.scheduled_for or utcnow(),
    )
    stamp_create(order, actor)          # created_by_id / updated_by_id
    db.session.add(order)
    db.session.flush()                   # get order.id before the audit row
    audit.log_create(actor, "lab_order", order, patient_id=patient.id)
    db.session.commit()                  # data + audit commit together, or neither
    return order


# Connected from app/routes/labs.py -> list_lab_orders()
def list_lab_orders(query):
    orders = LabOrder.query
    if query.patient_id is not None:
        orders = orders.filter(LabOrder.patient_id == query.patient_id)
    if query.status:
        orders = orders.filter(LabOrder.status == query.status)
    if query.date_from:
        orders = orders.filter(LabOrder.ordered_at >= query.date_from)
    if query.date_to:
        orders = orders.filter(LabOrder.ordered_at <= query.date_to)
    # Soft deleted rows are invisible: add .filter(LabOrder.deleted_at.is_(None))
    orders = orders.filter(LabOrder.deleted_at.is_(None))
    items, meta = paginate(
        orders.order_by(LabOrder.ordered_at.desc()), query.page, query.per_page
    )
    return [o.to_dict() for o in items], meta


# Connected from app/routes/labs.py -> change_status()
def change_status(actor, order_id, status_change):
    order = get_lab_order(order_id)
    if status_change.status not in TRANSITIONS[order.status]:
        raise Conflict(
            f"An order that is {order.status} cannot become {status_change.status}",
            code="INVALID_STATUS_CHANGE",
        )
    if status_change.status == "CANCELLED" and not status_change.reason:
        raise BusinessRuleError("A reason is required to cancel a lab order", code="REASON_REQUIRED")
    if status_change.status == "RESULTED" and not order.result_summary:
        raise BusinessRuleError("Record a result before marking the order resulted", code="RESULT_REQUIRED")

    before = order.to_dict()
    order.status = status_change.status
    if status_change.status == "RESULTED":
        order.resulted_at = utcnow()
    stamp_update(order, actor)
    # STATUS_CHANGE keeps the reason next to the change, like follow-ups do.
    audit.log_update(actor, "lab_order", order, before, patient_id=order.patient_id,
                     action="STATUS_CHANGE", reason=status_change.reason)
    db.session.commit()
    return order
```

### Step 5 — Route (HTTP surface)

**CREATE** `emr-api/emr-api/app/routes/labs.py`

```python
"""Lab order endpoints. Thin by design: permission -> parse -> one service call."""
from flask_jwt_extended import get_current_user

from app.docs import DocsBlueprint, Tag
from app.permissions import requires_permission
from app.schemas.labs import LabOrderCreate, LabOrderQuery, LabOrderStatusChange
from app.schemas.paths import LabOrderPath
from app.services import lab_service
from app.utils import created, ok, parse_body, parse_query

# DocsBlueprint adds the routes to the OpenAPI spec at /docs without taking
# over validation (that stays in app.utils, so errors keep one envelope).
bp = DocsBlueprint("labs", __name__, url_prefix="/labs", tags=[Tag(name="Laboratory")])


@bp.post("", summary="Order a lab test")
@requires_permission("lab:create")          # 403 before the view runs if the role lacks it
def create(body: LabOrderCreate = None):
    order = lab_service.create_lab_order(get_current_user(), parse_body(LabOrderCreate))
    return created(order.to_dict())          # 201


@bp.get("", summary="List lab orders")
@requires_permission("lab:read")
def list_lab_orders(query: LabOrderQuery = None):
    orders, meta = lab_service.list_lab_orders(parse_query(LabOrderQuery))
    return ok(orders, meta=meta)             # {"data": [...], "meta": {...}}


@bp.get("/<int:order_id>", summary="Get one lab order")
@requires_permission("lab:read")
def get_lab_order(order_id, path: LabOrderPath = None):
    order = lab_service.get_lab_order(order_id)
    return ok(order.to_dict())


@bp.patch("/<int:order_id>", summary="Record or edit a result")
@requires_permission("lab:update")
def update(order_id, body: LabOrderUpdate = None, path: LabOrderPath = None):
    order = lab_service.update_result(get_current_user(), order_id, parse_body(LabOrderUpdate))
    return ok(order.to_dict())


@bp.post("/<int:order_id>/status", summary="Collect, result or cancel an order")
@requires_permission("lab:update")
def change_status(order_id, body: LabOrderStatusChange = None, path: LabOrderPath = None):
    order = lab_service.change_status(get_current_user(), order_id, parse_body(LabOrderStatusChange))
    return ok(order.to_dict())


@bp.delete("/<int:order_id>", summary="Soft delete a lab order (reason required)")
@requires_permission("lab:delete")
def delete(order_id, body: DeleteRequest = None, path: LabOrderPath = None):
    lab_service.delete_lab_order(get_current_user(), order_id, parse_body(DeleteRequest).reason)
    return ok({"message": "Lab order deleted (kept for audit)"})
```

`DeleteRequest` comes from `app.schemas.common` — add it to the schema imports at the top of the
file. The two service functions those routes call, following the same pattern:

```python
# Connected from app/routes/labs.py -> update()
def update_result(actor, order_id, data):
    order = get_lab_order(order_id)
    if order.status != "COLLECTED":
        # Only a collected sample can carry a result.
        raise Conflict("Only a collected order can record a result", code="LAB_ORDER_NOT_COLLECTED")
    if not (data.result_summary or "").strip():
        raise BusinessRuleError("The result cannot be empty", code="RESULT_REQUIRED")
    before = order.to_dict()
    apply_changes(order, {"result_summary": data.result_summary.strip()})
    stamp_update(order, actor)
    audit.log_update(actor, "lab_order", order, before, patient_id=order.patient_id)
    db.session.commit()
    return order


# Connected from app/routes/labs.py -> delete()
def delete_lab_order(actor, order_id, reason):
    order = get_lab_order(order_id)
    # soft_delete sets deleted_at / deleted_by_id / delete_reason; the row stays.
    soft_delete(order, actor, reason)
    db.session.flush()
    audit.log_delete(actor, "lab_order", order, reason, patient_id=order.patient_id)
    db.session.commit()
    return order
```

Both need `soft_delete` added to the imports from `app.services.base`.

**EDIT** `emr-api/emr-api/app/routes/__init__.py` — two lines:

```python
# Line 1: add `labs` to the import list
from app.routes import admissions, audit, auth, encounters, followups, health, labs, patients, recycle_bin, surgeries, users, worklists

# Line 5: add `labs` to _MODULES so it is registered with the /api/v1 prefix
_MODULES = (auth, users, patients, encounters, admissions, surgeries, followups, worklists, audit, recycle_bin, labs, health)
```

### Step 6 — Permissions (backend)

**EDIT** `emr-api/emr-api/app/permissions.py`. Permission strings live in the role sets; ADMIN is
computed automatically from the union of every role plus `_ADMIN_ONLY` (line 68), so you only add
to clinical roles.

Add lab strings to `_DOCTOR_PERMISSIONS` (after line 34, inside the set) and to the roles that
should hold them:

```python
_DOCTOR_PERMISSIONS = {
    ...
    "followup:create", "followup:read", "followup:update",
    # Laboratory: clinicians order and interpret; nurses collect.
    "lab:create", "lab:read", "lab:update",
    "worklist:read",
}
```

For NURSE (collecting samples) add to the `NURSE` set (lines 53-61):

```python
    NURSE: {
        ...
        "lab:read", "lab:update",        # collect samples and record results only
        "worklist:read",
    },
```

Add the delete capability to `_ADMIN_ONLY` (lines 38-44):

```python
_ADMIN_ONLY = {
    "user:manage",
    ...
    "lab:delete",
}
```

Rule of thumb: 403 tests in `tests/test_permissions.py` should cover at least one role × one lab
endpoint, so a missing permission never ships silently.

### Step 7 — Run the backend

```powershell
cd C:\Users\DAN\Desktop\emr-api\emr-api
.\.venv\Scripts\python.exe -m flask db upgrade     # applies 0003
.\.venv\Scripts\python.exe -m pytest tests/test_labs.py -q
.\.venv\Scripts\python.exe -m flask run
# Docs now list the Laboratory tag at http://localhost:5000/docs
```

Smoke test:

```powershell
$login = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/login" -Method Post -ContentType "application/json" -Body '{"username":"doctor","password":"Demo@12345"}'
$h = @{ "Authorization" = "Bearer $($login.data.access_token)" }
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/labs" -Headers $h | ConvertTo-Json -Compress
```

### Step 8 — Frontend types

**EDIT** `emr-frontend/services/http/api-types.ts` — add after the `FollowUp` block (after line 242):

```ts
// ---------------------------------------------------------------------------
// Laboratory
// ---------------------------------------------------------------------------

export type LabOrder = {
  id: number;
  patient_id: number;
  encounter_id: number | null;
  ordered_by_id: number;
  test_code: string;
  test_name: string;
  result_summary: string | null;
  status: "ORDERED" | "COLLECTED" | "RESULTED" | "CANCELLED";
  ordered_at: string;
  resulted_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};
```

### Step 9 — Frontend service

**CREATE** `emr-frontend/services/labs/lab-service.ts`

```ts
/**
 * Lab order service — the only frontend code that talks to the lab API.
 *
 * Paths are relative to the BFF (`/api/...`); the proxy rewrites them to
 * `${FLASK_API_BASE_URL}/api/v1/...`. Copy the shape of
 * services/followups/followup-service.ts.
 */

import { getList, getOne, mutateOne } from "@/services/http/list-helpers";
import type { LabOrder, Paginated } from "@/services/http/api-types";

export type LabOrderFilters = {
  patient_id?: number;
  status?: LabOrder["status"];
  page?: number;
  per_page?: number;
};

export type LabOrderPayload = {
  patient_id: number;
  encounter_id?: number | null;
  test_code: string;
  test_name: string;
  scheduled_for?: string | null;
};

export type LabOrderStatusPayload = {
  status: "COLLECTED" | "RESULTED" | "CANCELLED";
  reason?: string | null;
};

/** CRUD plus the status workflow for lab orders. */
export const labOrderService = {
  list(filters: LabOrderFilters = {}): Promise<Paginated<LabOrder>> {
    return getList<LabOrder>("/lab-orders", { ...filters });
  },

  getById(orderId: string | number): Promise<LabOrder | null> {
    return getOne<LabOrder>(`/lab-orders/${orderId}`);
  },

  create(payload: LabOrderPayload): Promise<LabOrder> {
    return mutateOne<LabOrder>("/lab-orders", { method: "POST", body: payload });
  },

  update(orderId: string | number, payload: { result_summary: string }): Promise<LabOrder> {
    return mutateOne<LabOrder>(`/lab-orders/${orderId}`, { method: "PATCH", body: payload });
  },

  changeStatus(orderId: string | number, payload: LabOrderStatusPayload): Promise<LabOrder> {
    return mutateOne<LabOrder>(`/lab-orders/${orderId}/status`, { method: "POST", body: payload });
  },
};
```

Note the URL segment is `/lab-orders` while the Flask blueprint prefix is `/labs` — the service
path must match the **Flask** route, not the feature name. If Flask uses `/labs`, use `/labs` here.

### Step 10 — Zod schema

**CREATE** `emr-frontend/features/labs/schemas/lab-schema.ts`

```ts
import { z } from "zod";

/**
 * Client-side validation for ordering a lab test.
 *
 * This mirrors the Flask schema for fast, friendly feedback only. Flask stays
 * authoritative: the duplicate-open-order check, test-code pattern and status
 * transitions are all re-validated on the server.
 */

export const labOrderFormSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  test_code: z
    .string()
    .min(2, "Test code is required")
    .max(20)
    .regex(/^[A-Z0-9-]+$/, "Use capital letters, digits and hyphens only"),
  test_name: z.string().min(2, "Test name is required").max(120),
  encounter_id: z
    .string()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), "Enter a valid encounter ID"),
});

export type LabOrderFormValues = z.infer<typeof labOrderFormSchema>;

/** Converts validated form values into the Flask request payload. */
export function toLabOrderPayload(values: LabOrderFormValues) {
  return {
    patient_id: Number(values.patientId),
    test_code: values.test_code.toUpperCase(),
    test_name: values.test_name.trim(),
    encounter_id: values.encounter_id ? Number(values.encounter_id) : null,
  };
}
```

### Step 11 — Hook

**CREATE** `emr-frontend/features/labs/hooks/use-lab-orders.ts`

```ts
// Server-state hook backing the lab order table.
import useSWR from "swr";

import { labOrderService, type LabOrderFilters } from "@/services/labs/lab-service";
import type { LabOrder } from "@/services/http/api-types";

/** Builds a stable SWR cache key from the active filters. */
function buildKey(filters: LabOrderFilters): string {
  const params = new URLSearchParams();
  if (filters.patient_id) params.set("patient_id", String(filters.patient_id));
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(filters.page ?? 1));
  params.set("per_page", String(filters.per_page ?? 20));
  return `/lab-orders?${params.toString()}`;
}

/** Lab order search with caching, retry and revalidation. */
export function useLabOrders(filters: LabOrderFilters = {}) {
  const key = buildKey(filters);
  const { data, error, isLoading, mutate } = useSWR(key, () => labOrderService.list(filters));

  return {
    rows: (data?.data ?? []) as LabOrder[],
    meta: data?.meta ?? null,
    isLoading,
    error,
    mutate,
  };
}
```

### Step 12 — Table

**CREATE** `emr-frontend/features/labs/components/lab-orders-table.tsx` — copy the structure of
`features/followups/components/followups-table.tsx`: `DataTable` + `DataTableColumn[]`, a
`SelectNative` status filter, and a create button wrapped in `can(user, PERMISSIONS.labCreate)`.

### Step 13 — Form

**CREATE** `emr-frontend/features/labs/components/lab-order-form.tsx` — the pattern from
`followup-form.tsx`: `"use client"`, `useForm` + `zodResolver`, `PatientPicker` for the patient,
`onSubmit` calls `labOrderService.create(toLabOrderPayload(values))`, `toast.success`, then
`router.push(\`/laboratory/${order.id}\`)`. Show server errors via
`isApiError(error) ? error.displayMessage : "..."` so a 409 `LAB_ORDER_OPEN` reaches the user.

### Step 14 — Detail + status actions

**CREATE** `emr-frontend/features/labs/components/lab-order-detail.tsx` — the pattern from
`followup-detail.tsx`: SWR by id, a details card, and status buttons gated by
`can(user, PERMISSIONS.labUpdate)` that call `changeStatus`. Actions that are not valid from the
current status should be hidden, not disabled-and-failing.

If you add new status values, also extend `STATUS_TONES` in
`components/shared/status-badge.tsx` (lines 70-94), e.g. `RESULTED: "success"`, so badges are not
all neutral.

### Steps 15-16 — Pages

**CREATE** three thin route files (routes are always thin pages; components live in `features/`):

`emr-frontend/app/(app)/laboratory/page.tsx`

```tsx
/**
 * Laboratory list route: every lab order with a status filter.
 */
import { PageHeader } from "@/components/shared/page-header";
import { LabOrdersTable } from "@/features/labs/components/lab-orders-table";

export const metadata = { title: "Laboratory" };

export default function LaboratoryPage() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Laboratory" description="Order tests and record results." />
      <LabOrdersTable />
    </div>
  );
}
```

`emr-frontend/app/(app)/laboratory/new/page.tsx` — same as `follow-ups/new/page.tsx` (Suspense +
`LabOrderForm`), and `emr-frontend/app/(app)/laboratory/[orderId]/page.tsx` — same as
`follow-ups/[followUpId]/page.tsx` (`export default function LabOrderDetailPage() { return <LabOrderDetail />; }`).

### Step 17 — Frontend permissions

**EDIT** `emr-frontend/lib/permissions.ts`.

17a. Add to the `PERMISSIONS` object (after line 56, before the closing `}`):

```ts
  labView: "lab:read",
  labCreate: "lab:create",
  labUpdate: "lab:update",
```

The strings must match Flask exactly — `can()` compares the API-provided permission list verbatim,
so a typo here silently hides the button (the API stays strict).

17b. Add them to each role array in `ROLE_PERMISSIONS` (lines 67-142) that should have them —
NURSE and DOCTOR/SURGEON get `labView`/`labUpdate`; DOCTOR/SURGEON get `labCreate`; ADMIN gets
everything automatically because `ALL` is used for ADMIN (line 69).

### Step 18 — Navigation

**EDIT** `emr-frontend/components/app-shell/nav-items.ts`.

18a. Add an icon import (lines 2-14), e.g. `TestTube` or `FlaskConical` from `lucide-react`.

18b. Add an entry to the first section, after the Follow-ups entry (line 78):

```ts
      {
        title: "Laboratory",
        href: "/laboratory",
        icon: TestTube,
        permission: PERMISSIONS.labView,
      },
```

The sidebar re-filters itself at render time (`filterNavSections`, line 135), so the entry is
automatically hidden from roles without `lab:read`.

### Step 19 — Verify the frontend

```powershell
cd C:\Users\DAN\Desktop\emr-frontend
npm run typecheck
npm run lint
npm run build
npm run dev        # then open http://localhost:3000/laboratory
```

End-to-end acceptance: a DOCTOR sees the Laboratory nav entry and can create an order; a REGISTRAR
does not see the entry, and a direct visit to `/laboratory` shows the unauthorized/empty state and
any API call returns 403; the new rows appear in the admin **Audit logs** page with old/new values.

### Step 20 — Tests

**CREATE** `emr-api/emr-api/tests/test_labs.py`, covering: create → status flow happy path; 403 for
a role without `lab:create`; 409 when a second open order for the same test is created; 422 on a
bad test code; and (if soft delete exists) 404 after delete. Use the fixtures in
`tests/conftest.py` exactly as `test_followups`-style tests do.

---

## 3. Inventory variant

Same ten steps, different nouns. The differences worth planning for:

| Aspect | Laboratory | Inventory (stock) |
|---|---|---|
| Tables | `lab_orders` (+ optional `lab_tests` reference table) | `inventory_items`, `stock_movements` |
| Identity | one open order per patient per test | `sku` unique on `inventory_items` |
| Quantity | none | `quantity`, `reorder_level`; never negative (CHECK) |
| Key rules | status transitions; cannot result without a result | a movement cannot drive stock below zero; a movement never deletes stock — it appends |
| Status | ORDERED → COLLECTED → RESULTED / CANCELLED | IN_STOCK / LOW / OUT_OF_STOCK derived from quantity |
| Audit | CREATE / STATUS_CHANGE | CREATE / UPDATE (movements are the history) |
| Who | doctor/nurse creates, lab updates | ADMIN manages; NURSE/REGISTRAR records usage |
| Frontend | order form + result form | item manager (reuse the WardManager pattern from `features/wards/components/ward-manager.tsx`) |

For stock, model **movements** as append-only rows (like audit logs) and derive current quantity by
summing them — that is the same "occupancy is derived, never stored" decision the admissions
module already makes for beds, and it makes the whole history explainable.

---

## 4. How to EDIT an existing feature

Work outside-in: find the smallest layer that can hold the change, and stop there.

### 4.1 Change matrix — where each kind of edit belongs

| Change | Where | Do NOT touch |
|---|---|---|
| New field on an existing entity | migration → model → schema (create/update) → `api-types.ts` → zod schema → form (and table/detail if displayed) | routes, permissions |
| New validation rule | backend: service (business) or schema (format); frontend: zod for fast feedback | adding a rule only in the frontend |
| New status / transition | model CHECK + `LAB_ORDER_STATUSES` → migration → service `TRANSITIONS` → schema `Literal` → frontend type + `STATUS_TONES` | — |
| New endpoint | `app/routes/<domain>.py` + service function | `routes/__init__.py` (module already registered) |
| New permission | `app/permissions.py` sets → frontend `PERMISSIONS` + role arrays → `nav-items.ts` if gated | — |
| Change response shape | `SerializerMixin.to_dict()` (model `hidden_fields`) + `api-types.ts` | — |
| Change list filters | `app/schemas/<domain>.py` `Query` → service `list_*` → service filters type + hook key | — |

### 4.2 Worked edit: add "priority" to follow-ups

1. **Migration** — `emr-api/emr-api/migrations/versions/0004_followups_priority.py`,
   `down_revision = "0003"`:

   ```python
   def upgrade():
       op.add_column("follow_ups", sa.Column("priority", sa.String(length=10), nullable=False, server_default="ROUTINE"))
       op.create_check_constraint("ck_follow_ups_priority", "follow_ups", "priority IN ('ROUTINE', 'URGENT')")

   def downgrade():
       op.drop_constraint("ck_follow_ups_priority", "follow_ups", type_="check")
       op.drop_column("follow_ups", "priority")
   ```

2. **Model** `app/models/followup.py` — after line 22 add
   `priority = db.Column(db.String(10), nullable=False, default="ROUTINE")` and extend the
   existing `__table_args__` CheckConstraint pattern.
3. **Schema** `app/schemas/followups.py` — add `priority: Literal["ROUTINE", "URGENT"] = "ROUTINE"`
   to `FollowUpCreate` and `Optional[...]` to `FollowUpUpdate`. No service change is needed:
   `apply_changes` assigns any provided field and the audit diff picks it up automatically.
4. **Frontend type** `services/http/api-types.ts` — add `priority: "ROUTINE" | "URGENT";` to the
   `FollowUp` type (inside the block at lines 230-242).
5. **Zod** `features/followups/schemas/followup-schema.ts` — add the field with a select, and
   include it in `toPatientPayload`-style mapping.
6. **Form/table** — add the select (`SelectNative`) and, if useful, a column + filter.

Total: two new lines of migration, one model column, two schema lines, one type line, one zod field.
No route, permission or service logic changes — that is the payoff of `apply_changes` + generic
audit diffing.

### 4.3 Worked edit: change who may do something

1. Backend `app/permissions.py`: add/remove the permission string in the role sets (lines 25-68).
   Nothing else in the backend changes.
2. Frontend `lib/permissions.ts`: mirror the change in the role arrays (lines 67-142). If the role
   list on the client is stale, `can()` still prefers the API-provided list, so the UI self-corrects
   on the next login/refresh.
3. If navigation is affected, update `components/app-shell/nav-items.ts`; buttons gated by
   `PermissionGate` or `can(user, ...)` update automatically.

### 4.4 Worked edit: fix a wrong business rule

Rules live in **one** place per rule type: service function (`app/services/<domain>_service.py`).
Find the rule by its error `code` (grep for `code="..."`), fix it there, and add a test that would
have caught the bug. Never fix a rule in a route — that is where the architecture starts leaking.

### 4.5 Removing a feature

Remove in reverse order: pages → components → hooks → service → `api-types.ts` → `nav-items.ts`
→ permissions (both sides) → routes → service → schemas → model import → **keep** the migration
and the table (dropping clinical tables destroys history). A removal PR is small because every
layer was independent.

---

## 5. Gotchas

- **Double `/api` prefix** — paths passed to `bffRequest`/`getList` are relative to `/api`; passing
  `/api/labs` produces `/api/api/labs` and a 404.
- **`params`/`searchParams` are Promises** in Next.js 16 — `await` them in server components.
- **`useSearchParams`** requires a `<Suspense>` boundary or the build warns (see every `new/page.tsx`).
- **Soft-delete filters** — list queries must add `deleted_at IS NULL` yourself; `get_or_404`
  hides deleted rows but a hand-written `Model.query` does not.
- **Audit every write in the same transaction** — commit once, after the audit `add`. A commit
  between them is the one way to make data and audit disagree.
- **Permission strings must match exactly** between `app/permissions.py` and `lib/permissions.ts`
  — the client uses the API's list opaquely.
- **Empty values are dropped** from query strings by `listQuery`/`bffRequest`, so `page=1` must be
  sent explicitly, not as an empty string.
- **Never fabricate clinical data** — render `—` for nulls and only display metrics the API
  returned.
