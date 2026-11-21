# Backend API Reference — Nile Motors CDMS

> Frontend integration contract derived **directly from the Laravel source code** in `../backend`
> (repo `Ro-Vix/Car-Marketplace`, branch `main`, commit `fd3f710`).
> The backend is read-only for the frontend team. When this document and the code disagree, the code wins — update this file.

---

## Table of contents

1. [Backend overview](#1-backend-overview)
2. [Global conventions](#2-global-conventions)
3. [Authentication & session flow](#3-authentication--session-flow)
4. [Roles, permissions & branch scoping](#4-roles-permissions--branch-scoping)
5. [Errors & validation](#5-errors--validation)
6. [Pagination, search, filtering & sorting](#6-pagination-search-filtering--sorting)
7. [File uploads & downloads](#7-file-uploads--downloads)
8. [CORS, CSRF & cookies](#8-cors-csrf--cookies)
9. [Realtime capabilities](#9-realtime-capabilities)
10. [Rate limits](#10-rate-limits)
11. [Endpoint inventory by module](#11-endpoint-inventory-by-module)
12. [Enums & lookup values](#12-enums--lookup-values)
13. [Known gaps, inconsistencies & open questions](#13-known-gaps-inconsistencies--open-questions)

---

## 1. Backend overview

| Item                | Value                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Product             | Nile Motors — Car Dealership Management System (multi-branch)                                                        |
| Framework           | Laravel `^13.17`, PHP `^8.3`                                                                                         |
| Architecture        | Modular monolith via `nwidart/laravel-modules` (21 modules under `Modules/`)                                         |
| Database            | PostgreSQL (required — triggers, CHECKs, generated columns)                                                          |
| Auth                | Laravel Sanctum **personal access tokens (Bearer)**                                                                  |
| Authorization       | `spatie/laravel-permission` (roles + permissions) + Laravel Policies + branch scoping                                |
| Exports             | `maatwebsite/excel` (xlsx), `barryvdh/laravel-dompdf` (pdf), queued jobs                                             |
| Locale              | `ar` (default) / `en`, selected per request via `Accept-Language`                                                    |
| Timezone / currency | `Africa/Cairo` / `EGP`                                                                                               |
| API style           | REST, JSON only, versioned under `/api/v1`                                                                           |
| API docs            | None in repo. README links `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md` — **these files do not exist**. |
| Backend tests       | README describes extensive coverage, but **no `tests/` directories exist in the repository**.                        |

### Modules (all enabled in `modules_statuses.json`)

`Core`, `Auth`, `AccessControl`, `Organization`, `Settings`, `Dashboard`, `Notifications`, `Documents`, `ActivityLog`, `Inventory`, `Purchasing`, `Suppliers`, `Customers`, `Sales`, `Installments`, `BankFinancing`, `Treasury`, `Expenses`, `HR`, `Commissions`, `Reports`.

`Core` has no routes; it provides the response envelope, exception renderer, `ListQuery`, `Money`, branch scoping, the permission matrix and rate limiters.

### Seeded development accounts (password `password`)

| Email                          | Role                          |
| ------------------------------ | ----------------------------- |
| admin@nilemotors.test          | Super Admin                   |
| gm@nilemotors.test             | General Manager               |
| cairo.manager@nilemotors.test  | Branch Manager (Nasr City)    |
| sales.cairo@nilemotors.test    | Sales Employee (Nasr City)    |
| treasury.cairo@nilemotors.test | Treasury Employee (Nasr City) |
| accountant@nilemotors.test     | Accountant (all branches)     |

Use these only against a local backend. They are useful for E2E tests that need different roles.

---

## 2. Global conventions

### Base URL

```
{BACKEND_URL}/api/v1
```

Local default `BACKEND_URL` = `http://localhost:8000` (`APP_URL`). Every module registers its routes with middleware `api` + `locale` under the prefix `api/v1` and route-name prefix `api.v1.`.

### Required request headers

| Header            | Value                                                     | Why                                                                                                            |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Accept`          | `application/json`                                        | Ensures JSON errors (also forced for `api/*`).                                                                 |
| `Content-Type`    | `application/json` (or `multipart/form-data` for uploads) |                                                                                                                |
| `Authorization`   | `Bearer <token>`                                          | All routes except login / forgot-password / reset-password.                                                    |
| `Accept-Language` | `ar` or `en`                                              | Selects language of `message`, validation messages and notification texts. Response echoes `Content-Language`. |

### Response envelope

Every JSON response (success and error) uses the same envelope (`App\Http\Traits\ResponsesTrait`):

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {},
  "errors": null
}
```

| Helper                      | HTTP | `success` | `data`                          | `errors`                                              |
| --------------------------- | ---- | --------- | ------------------------------- | ----------------------------------------------------- |
| `respondOk`                 | 200  | true      | resource / array / null         | null                                                  |
| `respondCreated`            | 201  | true      | resource                        | null                                                  |
| report export queued        | 202  | true      | export status object            | null                                                  |
| `respondPaginated`          | 200  | true      | `{ items: [], pagination: {} }` | null                                                  |
| validation                  | 422  | false     | null                            | `{ field: [messages] }`                               |
| business rule               | 409  | false     | null                            | `{ code: "...", ...extra }`                           |
| 401 / 403 / 404 / 429 / 500 | —    | false     | null                            | null (500 adds debug info only when `APP_DEBUG=true`) |

Deletes return **200 with `data: null`**, not 204.

### Data formats

| Kind                    | Format                                                                                                                                                                                                    | Frontend rule                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Money                   | **string** with 2 decimals, e.g. `"125000.00"` (`NUMERIC(15,2)`, backend never uses floats)                                                                                                               | Never do arithmetic with JS `number` on money; display via `Intl.NumberFormat`; send as string or number with ≤ 2 decimals. |
| Dates                   | `YYYY-MM-DD` (e.g. `contract_date`, `due_date`)                                                                                                                                                           |                                                                                                                             |
| Timestamps (Resources)  | ISO‑8601 with offset, e.g. `2026-11-21T15:06:00+02:00`                                                                                                                                                    |                                                                                                                             |
| Timestamps (raw models) | Laravel default serialization `2026-11-21T13:06:00.000000Z` (UTC) — returned by endpoints that return raw models (catalog, banks, expense categories, HR lookups, attendance, commission rules)           | Parse both forms.                                                                                                           |
| Booleans                | JSON `true/false`; accepted on input as `true/false/1/0`                                                                                                                                                  |                                                                                                                             |
| IDs                     | integers; notification IDs are UUIDs                                                                                                                                                                      |                                                                                                                             |
| Polymorphic refs        | `{ "type": "sales_contract", "id": 12 }` using morph aliases (`vehicle`, `purchase_order`, `sales_contract`, `customer`, `supplier`, `bank_financing_application`, `employee`, `expense`, `user`, `bank`) |                                                                                                                             |

### Conditional / hidden fields

Some fields are **omitted** (key absent, not `null`) depending on permission — types must mark them optional:

| Resource      | Field(s)                                           | Condition                                                                                                         |
| ------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Vehicle       | `purchase_price`, `additional_costs`, `total_cost` | `vehicles.view-cost`                                                                                              |
| Employee      | `salary`                                           | `employees.view-salary`                                                                                           |
| BankFinancing | `internal_notes`                                   | `bank-financing.update`                                                                                           |
| User          | `permissions`                                      | only on `GET /auth/me`                                                                                            |
| Customer      | `national_id`                                      | Always present but **masked** (`**********1234`) unless `?include=national_id` **and** `customers.view-sensitive` |

---

## 3. Authentication & session flow

### Mechanism

- **Sanctum personal access tokens** sent as `Authorization: Bearer <token>`.
- The API is **stateless**: `bootstrap/app.php` does not enable `statefulApi()`, CORS has `supports_credentials: false`, so **Sanctum cookie/SPA session auth is not available** without backend changes. `GET /sanctum/csrf-cookie` is listed in CORS paths but is irrelevant for this flow.
- Token lifetime: `SANCTUM_TOKEN_EXPIRATION` minutes (default **10080 = 7 days**). `expires_at` is returned on login/refresh.
- There is **no refresh token**. `POST /auth/refresh` exchanges the current (still valid) token for a new one and deletes the old token.

### Endpoints

| Method | Path                    | Auth | Throttle    | Body                                                       | Success `data`                                              |
| ------ | ----------------------- | ---- | ----------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| POST   | `/auth/login`           | —    | `auth`      | `email`_, `password`_, `device_name?` (≤100)               | `{ token, token_type: "Bearer", expires_at, user: User }`   |
| GET    | `/auth/me`              | ✓    | api         | —                                                          | `User` **including `permissions`**                          |
| POST   | `/auth/refresh`         | ✓    | api         | —                                                          | `{ token, expires_at, token_type }`                         |
| POST   | `/auth/logout`          | ✓    | api         | —                                                          | `null` (current token deleted)                              |
| POST   | `/auth/logout-all`      | ✓    | api         | —                                                          | `{ revoked_tokens: number }`                                |
| POST   | `/auth/change-password` | ✓    | `sensitive` | `current_password`_, `password`_, `password_confirmation`* | `null` — **all other tokens are revoked**, current one kept |
| POST   | `/auth/forgot-password` | —    | `auth`      | `email`*                                                   | `null` (always same response, no user enumeration)          |
| POST   | `/auth/reset-password`  | —    | `auth`      | `email`_, `token`_, `password`_, `password_confirmation`_  | `null` — **all tokens revoked**                             |

Password rule (change/reset/user create): min 8, must contain letters and numbers; change-password also requires `password` ≠ `current_password`.

#### `User` resource

```ts
{
  id: number; name: string; email: string; phone: string | null;
  is_active: boolean; locale: 'ar' | 'en';
  last_login_at: string | null;           // ISO-8601
  roles?: string[];                        // role names
  permissions?: string[];                  // only on /auth/me, sorted
  branches?: { id: number; name: string; code: string }[];
  created_at: string;
}
```

#### Login errors

| Case                 | HTTP | Shape                                                           |
| -------------------- | ---- | --------------------------------------------------------------- |
| wrong email/password | 422  | `errors.email: ["These credentials do not match our records."]` |
| disabled account     | 409  | `errors.code = "account_disabled"`                              |
| too many attempts    | 429  | —                                                               |

### Password reset link

The email links to `FRONTEND_RESET_PASSWORD_URL` (default `http://localhost:3000/reset-password`) with query `?token=<token>&email=<email>`. The frontend must provide a `/reset-password` route that reads both params and calls `POST /auth/reset-password`. Reset tokens expire after 60 minutes; one request per 60 s per user.

### Recommended client flow

```
App boot
 ├─ token in storage? ── no ──▶ /login
 └─ yes ─▶ GET /auth/me
            ├─ 200 ─▶ store user + permissions (session ready)
            └─ 401 ─▶ clear token ─▶ /login
Login  ─▶ POST /auth/login ─▶ save token + expires_at ─▶ GET /auth/me (login response has no permissions)
Any 401 ─▶ clear token + query cache ─▶ /login?redirect=...
Near expiry (e.g. < 24h left) ─▶ POST /auth/refresh ─▶ replace token
Logout ─▶ POST /auth/logout (ignore errors) ─▶ clear local state
```

> **Decision needed:** where to keep the token (see §13). The backend gives us no httpOnly-cookie option.

---

## 4. Roles, permissions & branch scoping

### Permission names

Format `{resource}.{ability}` (from `Modules/Core/config/config.php`). Guard `web`.

| Resource           | Abilities                                                 |
| ------------------ | --------------------------------------------------------- |
| users              | view, create, update, delete                              |
| roles              | view, create, update, delete                              |
| branches           | view, create, update, delete, **access-all**              |
| company            | view, update                                              |
| settings           | view, update                                              |
| vehicles           | view, create, update, delete, transfer, export, view-cost |
| vehicle-catalog    | view, create, update, delete                              |
| purchase-orders    | view, create, update, approve, cancel, export             |
| suppliers          | view, create, update, delete, export                      |
| customers          | view, create, update, delete, export, view-sensitive      |
| reservations       | view, create, cancel                                      |
| sales-contracts    | view, create, cancel, export                              |
| installments       | view, collect, export                                     |
| bank-financing     | view, create, update, collect, export                     |
| banks              | view, create, update, delete                              |
| cashboxes          | view, create, update                                      |
| treasury           | view, create, reverse, export                             |
| expenses           | view, create, update, delete, approve, pay, export        |
| expense-categories | view, create, update, delete                              |
| employees          | view, create, update, delete, view-salary                 |
| hr-setup           | view, create, update, delete                              |
| attendance         | view, create, update                                      |
| commission-rules   | view, create, update                                      |
| commissions        | view, pay, export                                         |
| documents          | view, create, delete                                      |
| activity-logs      | view                                                      |
| dashboard          | view                                                      |
| reports            | view, export                                              |

`GET /permissions` returns them grouped: `{ "vehicles": ["vehicles.create", ...], ... }`.

### System roles (`SystemRole` enum) and default grants

| Role                | Default permissions                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Super Admin         | all (`*`) + `Gate::before` → **every check passes**                                                                                                                                                                                                                                                                                                                                                                               |
| General Manager     | all (`*`)                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Branch Manager      | branches.view, company.view, settings.view, dashboard.view, reports._, vehicles._, vehicle-catalog.view, purchase-orders._, suppliers._, customers._, reservations._, sales-contracts._, installments._, bank-financing._, banks.view, cashboxes.view, treasury._, expenses._, expense-categories.view, employees.view, attendance._, commissions.view/export, commission-rules.view, documents.*, activity-logs.view, users.view |
| Sales Employee      | dashboard.view, vehicles.view, vehicle-catalog.view, customers.view/create/update, reservations.view/create, sales-contracts.view/create, installments.view, bank-financing.view/create/update, banks.view, documents.view/create, commissions.view                                                                                                                                                                               |
| Purchasing Employee | dashboard.view, vehicles.view/create/update/view-cost/transfer, vehicle-catalog.*, purchase-orders.view/create/update, suppliers.view/create/update, documents.view/create                                                                                                                                                                                                                                                        |
| Treasury Employee   | dashboard.view, cashboxes.view, treasury.view/create, installments.view/collect, bank-financing.view/collect, expenses.view/pay, commissions.view/pay, purchase-orders.view, suppliers.view, customers.view, sales-contracts.view, documents.view/create, reports.view                                                                                                                                                            |
| HR Employee         | employees._, hr-setup._, attendance.*, documents.view/create                                                                                                                                                                                                                                                                                                                                                                      |
| Accountant          | dashboard.view, reports.*, treasury.view/export, cashboxes.view, installments.view/export, sales-contracts.view/export, purchase-orders.view, suppliers.view, customers.view, expenses.view/export, commissions.view/export, bank-financing.view, vehicles.view/view-cost, documents.view                                                                                                                                         |
| Read-only User      | `*.view`                                                                                                                                                                                                                                                                                                                                                                                                                          |

- System roles **cannot be deleted** (409 `system_role_protected`); `Super Admin` cannot be updated.
- Custom roles can be created with any permission set.
- A user with role `Super Admin` cannot be updated/deleted through the API; a user cannot delete themself.

### Branch scoping (server-enforced)

- Each user is attached to branches (`user.branches`).
- **Super Admin** or permission **`branches.access-all`** → access to all branches.
- Otherwise list endpoints are filtered to the user's branches, and single-record actions return **403** when the record's `branch_id` is not accessible.
- `branch_id` sent in request bodies/filters is checked; a foreign branch → 403 `"You do not have access to this branch."`.
- Suppliers, vehicle catalog, banks, expense categories and HR lookups are **global** (not branch-scoped).

### How the frontend should use authorization

- Source of truth: `GET /auth/me` → `roles[]`, `permissions[]`, `branches[]`.
- `can(permission)` = `roles.includes('Super Admin') || permissions.includes(permission)`.
- `canAccessAllBranches` = Super Admin || `permissions.includes('branches.access-all')`.
- Use these only to **hide/disable UI**. The backend remains the security boundary; always handle 403.
- Record-level ownership (branch) is not exposed as flags — rely on 403 from the server.

---

## 5. Errors & validation

Rendered centrally by `Modules\Core\Exceptions\ApiExceptionRenderer`.

| HTTP                                                                  | When                                     | `message`                                                            | `errors`                                            |
| --------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| 401                                                                   | missing/expired/revoked token            | "Unauthenticated."                                                   | null                                                |
| 403                                                                   | policy/permission/branch denial          | "You are not authorized to perform this action." (or branch message) | null                                                |
| 404                                                                   | model or route not found                 | "The requested resource was not found."                              | null                                                |
| 409                                                                   | `BusinessRuleException` (domain rule)    | localized rule message                                               | `{ code: string, ...context }`                      |
| 415                                                                   | document preview of non-previewable type | generic                                                              | null                                                |
| 422                                                                   | `ValidationException`                    | "The given data was invalid."                                        | `{ "field.path": ["msg", ...] }`                    |
| 429                                                                   | throttled                                | "Too many requests. Please slow down."                               | null                                                |
| 500                                                                   | anything else                            | generic                                                              | `{ exception, message }` only when `APP_DEBUG=true` |
| other `HttpException` (e.g. `abort(422, 'msg')`, `abort(409, 'msg')`) | —                                        | the abort message                                                    | **null**                                            |

### Validation error example

```json
{
  "success": false,
  "message": "The given data was invalid.",
  "data": null,
  "errors": {
    "phone": ["The phone field format is invalid."],
    "vehicles.0.model_id": ["The selected model does not belong to the brand."]
  }
}
```

- Keys use dot notation for nested arrays (`vehicles.0.costs.1.amount`, `installments.3.due_date`, `payment.cashbox_id`).
- Unknown `filter[...]` keys and non‑allowlisted `sort` values also produce **422** (`filter.xyz`, `sort`).
- Messages are localized by `Accept-Language`.

### Business-rule (409) codes seen in controllers

| Code                                | Where                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `account_disabled`                  | login                                                                                 |
| `system_role_protected`             | delete system role                                                                    |
| `catalog_in_use`                    | delete brand/model referenced by vehicles                                             |
| `use_installment_payments`          | `POST /sales-contracts/{id}/payments` on an installment contract                      |
| `no_commission`                     | commission calculate when none applies                                                |
| `business_rule_violation` (default) | services (double sale, invalid status transition, insufficient cashbox balance, etc.) |

Services throw additional codes; the frontend should **display `message`** and branch on `errors.code` only where a specific UX is needed.

### Inconsistent error shapes to normalize

- `POST /purchase-orders/{id}/costs` with a vehicle not in the order → `abort(422, msg)` → 422 with **`errors: null`** (not field errors).
- `PUT /commission-rules/{id}` on an inactive rule → `abort(409, msg)` → 409 with **`errors: null`** (no `code`).
- `POST /customers/lookup` not found → 404 envelope (an expected outcome, not an error UI).

---

## 6. Pagination, search, filtering & sorting

Implemented by `Modules\Core\Support\ListQuery` (allowlisted — never raw columns).

| Param                  | Format                                             | Notes                                                 |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| `page`                 | int ≥ 1                                            |                                                       |
| `per_page`             | int 1–100                                          | default **15** (notifications 20, reports 25)         |
| `search`               | string                                             | ILIKE across endpoint‑specific columns, max 100 chars |
| `filter[key]`          | `value` or `a,b` (comma list) or `filter[key][]=a` | unknown key → 422                                     |
| `date_from`, `date_to` | `YYYY-MM-DD`                                       | applied to the endpoint's date column (inclusive)     |
| `sort`                 | `column` or `-column` (desc)                       | unknown → 422; `id` always allowed                    |

### Paginated response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "items": [],
    "pagination": { "current_page": 1, "per_page": 15, "total": 42, "last_page": 3 }
  },
  "errors": null
}
```

There are no `links`/cursor fields. Keep list state (page, per_page, search, filters, sort) in the URL query string.

Each endpoint's searchable/filterable/sortable keys are listed in §11 as **S** (search columns), **F** (filters), **O** (sort keys, default first), **D** (date-range column).

### Non-paginated list endpoints (return a plain array)

`GET /roles`, `/permissions` (object), `/banks`, `/expense-categories`, `/hr/{type}`, `/vehicles/{id}/sales`, `/sales-contracts/{id}/payments` (object), `/purchase-orders/{id}/payments`, `/installments/{id}/payments`, `/bank-financing-applications/{id}/receipts`, `/documents`, `/settings/numbering`, `/notifications/preferences`, `/reports`.

---

## 7. File uploads & downloads

### Uploads (`multipart/form-data`, with `Authorization` header)

| Endpoint                          | Field                                                                        | Rules                                                        | Storage                                    |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| `POST /vehicles/{vehicle}/images` | `image`*, `is_primary?`                                                      | image jpg/jpeg/png/webp, ≤ **5 MB**                          | `public` disk → **publicly reachable URL** |
| `POST /documents`                 | `file`_, `documentable_type`_, `documentable_id`_, `name`_, `document_type`* | pdf, jpg, jpeg, png, webp, doc, docx, xls, xlsx, ≤ **10 MB** | private disk (`DOCUMENTS_DISK`)            |

- Vehicle images return `{ id, url, is_primary }`; `url` is an absolute public URL (`{APP_URL}/storage/vehicles/{id}/...`, requires `php artisan storage:link`) — usable directly in `<img src>`.
- Use `FormData`; do **not** set `Content-Type` manually (browser sets the boundary). Booleans in multipart should be sent as `1`/`0`.
- Show client-side checks (type/size) for UX but rely on 422 from the server.

### Downloads (authenticated binary)

| Endpoint                            | Response                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `GET /documents/{id}/download`      | file stream, `Content-Disposition: attachment; filename=...`                |
| `GET /documents/{id}/preview`       | inline stream for pdf/jpeg/png/webp (415 otherwise); strict CSP + `nosniff` |
| `GET /report-exports/{id}/download` | xlsx/pdf stream (only owner, only when `status = completed`)                |

Because these require the **Bearer header**, a plain `<a href>` / `<iframe src>` will get 401. The frontend must `fetch` as `Blob`, then use `URL.createObjectURL` (and read the filename from `Content-Disposition`, which CORS exposes). Revoke object URLs after use.

### Report exports (async)

```
POST /reports/{category}/export  { type, format: "xlsx"|"pdf", ...filters }  → 202 { id, status: "queued", ... }
GET  /report-exports/{id}        → poll until status = "completed" | "failed"
GET  /report-exports/{id}/download → Blob
```

`download_url` in the status payload is an absolute URL built from `APP_URL`; still requires the Bearer token. A queue worker (`php artisan queue:work --queue=default,exports`) must run for exports to complete.

---

## 8. CORS, CSRF & cookies

From `config/cors.php`, `config/sanctum.php`, `bootstrap/app.php`:

| Setting                               | Value                                                                    | Impact                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `paths`                               | `api/*`, `sanctum/csrf-cookie`                                           |                                                                                                         |
| `allowed_origins`                     | `CORS_ALLOWED_ORIGINS` (comma list), default **`http://localhost:3000`** | Vite's default port is 5173 → either run Vite on **port 3000** or add the origin to the backend `.env`. |
| `allowed_methods` / `allowed_headers` | `*`                                                                      |                                                                                                         |
| `exposed_headers`                     | `Content-Disposition`, `Content-Language`                                | Needed for download filenames and locale.                                                               |
| `supports_credentials`                | **false**                                                                | Do not send `credentials: 'include'`; cookies are not part of the flow.                                 |
| CSRF                                  | Not applicable (stateless token API; no `statefulApi()`)                 | No `XSRF-TOKEN` handling needed.                                                                        |
| `sanctum.stateful`                    | `localhost, localhost:3000, 127.0.0.1, 127.0.0.1:8000, ::1`              | Unused while the API group is stateless.                                                                |

**Development options:**

1. **Recommended:** Vite dev-server **proxy** `/api` → `http://localhost:8000` (same-origin in dev, CORS irrelevant), and in production serve the SPA behind the same domain or set `CORS_ALLOWED_ORIGINS` accordingly.
2. Call `http://localhost:8000/api/v1` directly with Vite on port 3000.

---

## 9. Realtime capabilities

- **None.** `BROADCAST_CONNECTION=log`, no `config/broadcasting.php`, no `ShouldBroadcast` events, no channel routes. No Reverb/Pusher/Soketi.
- Notifications are stored in the database (and queued); the frontend must **poll** `GET /notifications/unread-count` (e.g. every 30–60 s and on window focus).
- Dashboard data is cached server-side; refetch on focus/interval is sufficient.

---

## 10. Rate limits

| Limiter     | Limit                                    | Applied to                                                                          |
| ----------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `api`       | 120 req/min per user (or IP)             | every API route                                                                     |
| `auth`      | 5/min per email+IP **and** 20/min per IP | login, forgot-password, reset-password                                              |
| `sensitive` | 30/min per user                          | money movements, user/role admin, document upload, customer lookup, change-password |
| `exports`   | 10/min per user                          | report export creation                                                              |

Handle **429** with a clear message; do not auto-retry mutations. Avoid aggressive polling/refetch storms (120/min budget is shared per user).

---

## 11. Endpoint inventory by module

Legend: `*` required · `?` optional · **S** search columns · **F** filters · **O** sort keys (default first) · **D** date-range column · 🔒 permission check · ⏱ throttle `sensitive`.
All routes require `Authorization: Bearer` unless stated.

### 11.1 Auth — see §3

### 11.2 Access control (users & roles) — all routes ⏱

| Method | Path                   | 🔒                                                   | Request                                                                                                                                   | Response `data`                       |
| ------ | ---------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| GET    | `/permissions`         | roles.view                                           | —                                                                                                                                         | `{ [resource]: string[] }`            |
| GET    | `/roles`               | roles.view                                           | —                                                                                                                                         | `Role[]` with `users_count`           |
| POST   | `/roles`               | roles.create                                         | `name`* (≤100, unique), `permissions?: string[]`                                                                                          | `Role` (with permissions)             |
| GET    | `/roles/{id}`          | roles.view                                           | —                                                                                                                                         | `Role` with permissions + users_count |
| PUT    | `/roles/{id}`          | roles.update (not Super Admin)                       | `name?`, `permissions?` (full replace)                                                                                                    | `Role`                                |
| DELETE | `/roles/{id}`          | roles.delete (not system roles)                      | —                                                                                                                                         | null                                  |
| GET    | `/users`               | users.view                                           | **S** name,email,phone · **F** is_active, role (names), branch_id · **O** name,email,created_at,last_login_at                             | paginated `User` (roles, branches)    |
| POST   | `/users`               | users.create                                         | `name`_, `email`_ (unique, lower-cased), `phone?`, `password`*, `is_active?`, `locale?` (ar/en), `roles?: string[]`, `branch_ids?: int[]` | `User`                                |
| GET    | `/users/{id}`          | self, or users.view + shared branch                  | —                                                                                                                                         | `User`                                |
| PUT    | `/users/{id}`          | users.update + shared branch, target not Super Admin | `name?`, `email?`, `phone?`, `password?`, `is_active?`, `locale?`                                                                         | `User`                                |
| DELETE | `/users/{id}`          | users.delete, not self, not Super Admin              | —                                                                                                                                         | null                                  |
| PUT    | `/users/{id}/roles`    | as update                                            | `roles`* (present array, may be empty)                                                                                                    | `User`                                |
| PUT    | `/users/{id}/branches` | as update                                            | `branch_ids`* (present array)                                                                                                             | `User`                                |
| DELETE | `/users/{id}/tokens`   | as update                                            | —                                                                                                                                         | `{ revoked_tokens }`                  |

`Role`: `{ id, name, users_count?, permissions?: string[] }`

### 11.3 Organization

| Method         | Path             | 🔒                                          | Request                                                                                                                  | Response                                                                                     |
| -------------- | ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| GET            | `/company`       | company.view                                | —                                                                                                                        | `{ id, name, legal_name, tax_number, commercial_register, phone, email, address, currency }` |
| PUT            | `/company`       | company.update                              | any of the above fields; `currency` 3 letters                                                                            | same                                                                                         |
| GET            | `/branches`      | branches.view (scoped)                      | **S** name,code,city · **F** status, city · **O** name,code,city,created_at                                              | paginated `Branch`                                                                           |
| POST           | `/branches`      | branches.create                             | `name`_, `code`_ (alpha_dash ≤20 unique), `city?`, `address?`, `phone?`, `manager_user_id?`, `status?` (active/inactive) | `Branch`                                                                                     |
| GET/PUT/DELETE | `/branches/{id}` | branches.view/update/delete + branch access | same fields, all optional on PUT                                                                                         | `Branch` / null                                                                              |

`Branch`: `{ id, name, code, city, address, phone, status, manager: {id,name}|null, users_count?, created_at }`

### 11.4 Settings

| Method | Path                  | 🔒                | Request                                                                       | Response                                                                                                  |
| ------ | --------------------- | ----------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| GET    | `/settings`           | settings.view     | —                                                                             | all groups `{ general: {...}, payments: {...}, ... }`                                                     |
| GET    | `/settings/lookups`   | any authenticated | —                                                                             | `{ locales: string[], currency, payment_methods: string[] (enabled), installment_frequencies: string[] }` |
| GET    | `/settings/{group}`   | settings.view     | group ∈ general, payments, installments, treasury, commissions, notifications | group object                                                                                              |
| PUT    | `/settings/{group}`   | settings.update   | see table below                                                               | updated group                                                                                             |
| GET    | `/settings/numbering` | settings.view     | —                                                                             | `[{ key, prefix, padding, reset_yearly, next_number }]`                                                   |
| PUT    | `/settings/numbering` | settings.update   | `key`_, `prefix`_ (`^[A-Z0-9]+$` ≤20), `padding`* (3–12), `reset_yearly`*     | `{ key, prefix, padding, reset_yearly, next_number }`                                                     |

| Group         | Keys (defaults)                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| general       | `default_locale` (ar), `currency` (EGP), `timezone` (Africa/Cairo), `date_format` (Y-m-d)                   |
| payments      | `enabled_methods` (all 5)                                                                                   |
| installments  | `enabled_frequencies` (monthly, quarterly, semi_annual, annual, custom), `upcoming_reminder_days` (3, 1–60) |
| treasury      | `allow_negative_cashbox_balance` (false)                                                                    |
| commissions   | `enabled` (true)                                                                                            |
| notifications | `enabled_types` (list of notification types)                                                                |

Numbering keys: vehicle_stock, vehicle_transfer, purchase_order, sales_contract, reservation, receipt, payment, expense, customer, supplier, employee, bank_financing.

> Use `GET /settings/lookups` to populate payment-method and installment-frequency selects — only **enabled** values pass validation.

### 11.5 Inventory

**Catalog** (global, list endpoints have **no permission check**)

| Method          | Path                     | 🔒                     | Request                                               | Response                                                                               |
| --------------- | ------------------------ | ---------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| GET             | `/vehicle-brands`        | —                      | **S** name,country · **F** is_active · **O** name     | paginated raw `{ id, name, country, is_active, models_count, created_at, updated_at }` |
| POST            | `/vehicle-brands`        | vehicle-catalog.create | `name`* (unique ≤100), `country?`, `is_active?`       | brand                                                                                  |
| PUT             | `/vehicle-brands/{id}`   | vehicle-catalog.update | same, optional                                        | brand                                                                                  |
| DELETE          | `/vehicle-brands/{id}`   | vehicle-catalog.delete | —                                                     | null, or 409 `catalog_in_use`                                                          |
| GET             | `/vehicle-models`        | —                      | **S** name · **F** brand_id, is_active · **O** name   | paginated raw `{ id, brand_id, name, is_active, brand: {id,name}, ... }`               |
| POST/PUT/DELETE | `/vehicle-models[/{id}]` | vehicle-catalog.*      | `brand_id`_, `name`_ (unique per brand), `is_active?` | model                                                                                  |

**Vehicles** (branch-scoped)

| Method | Path                              | 🔒                                   | Request                                                                                                                                                                                                                                                                            | Response                                                                                                                                 |
| ------ | --------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/vehicles`                       | vehicles.view                        | **S** stock_number, vin, engine_number, color, brand.name, model.name · **F** status, branch_id, brand_id, model_id, year, fuel_type, transmission, vehicle_type, supplier_id · **O** -created_at, stock_number, year, selling_price, mileage, purchase_date · **D** purchase_date | paginated `Vehicle`                                                                                                                      |
| POST   | `/vehicles`                       | vehicles.create                      | see VehicleRequest                                                                                                                                                                                                                                                                 | `Vehicle`                                                                                                                                |
| GET    | `/vehicles/{id}`                  | vehicles.view                        | —                                                                                                                                                                                                                                                                                  | `Vehicle` with `supplier`, `images`                                                                                                      |
| PUT    | `/vehicles/{id}`                  | vehicles.update                      | same fields (optional); `branch_id`, `purchase_price`, `status` **prohibited**                                                                                                                                                                                                     | `Vehicle`                                                                                                                                |
| DELETE | `/vehicles/{id}`                  | vehicles.delete                      | —                                                                                                                                                                                                                                                                                  | null                                                                                                                                     |
| POST   | `/vehicles/{id}/status`           | vehicles.update                      | `status`* ∈ **available, under_maintenance** only, `reason`* (≤255)                                                                                                                                                                                                                | `Vehicle`                                                                                                                                |
| GET    | `/vehicles/{id}/history`          | vehicles.view                        | —                                                                                                                                                                                                                                                                                  | `{ status_history: [{from_status,to_status,reason,source,changed_by,created_at}], movements: VehicleMovement[], costs: Cost[] \| null }` |
| GET    | `/vehicles/{id}/costs`            | vehicles.view-cost                   | —                                                                                                                                                                                                                                                                                  | `{ purchase_price, additional_costs, total_cost, items: Cost[] }`                                                                        |
| POST   | `/vehicles/{id}/costs`            | vehicles.update + view-cost          | `cost_type`_, `amount`_ (>0), `cost_date`* (≤ today), `description?`, `cashbox_id?` → then `payment_method`* & `payee_name`* (creates a treasury payment)                                                                                                                          | `{ id, vehicle_id, cost_type, amount, cost_date, description, treasury_transaction_id }`                                                 |
| POST   | `/vehicles/{id}/images`           | vehicles.update                      | multipart `image`*, `is_primary?`                                                                                                                                                                                                                                                  | `{ id, url, is_primary }`                                                                                                                |
| DELETE | `/vehicles/{id}/images/{imageId}` | vehicles.update                      | —                                                                                                                                                                                                                                                                                  | null                                                                                                                                     |
| POST   | `/vehicles/{id}/transfer`         | vehicles.transfer + branch           | `to_branch_id`*, `notes?`                                                                                                                                                                                                                                                          | `VehicleMovement` (status in_transit)                                                                                                    |
| GET    | `/vehicle-transfers`              | vehicles.view                        | **S** reference, vehicle.stock_number · **F** status, vehicle_id, from_branch_id, to_branch_id · **O** -initiated_at, completed_at · **D** initiated_at                                                                                                                            | paginated `VehicleMovement`                                                                                                              |
| POST   | `/vehicle-transfers/{id}/receive` | vehicles.transfer                    | —                                                                                                                                                                                                                                                                                  | `VehicleMovement`                                                                                                                        |
| POST   | `/vehicle-transfers/{id}/cancel`  | vehicles.transfer                    | —                                                                                                                                                                                                                                                                                  | `VehicleMovement`                                                                                                                        |
| GET    | `/vehicles/{id}/sales`            | vehicles.view + sales-contracts.view | —                                                                                                                                                                                                                                                                                  | `SalesContract[]`                                                                                                                        |

VehicleRequest (create): `brand_id`_, `model_id`_ (must belong to brand), `year`* (1950..next year), `transmission`_, `fuel_type`_, `vehicle_type`_, `branch_id`_, `stock_number?` (auto `STK…`), `vin?` (17 chars, no I/O/Q, unique), `engine_number?`, `color?`, `mileage?` (0–2,000,000), `purchase_price?`, `selling_price?`, `purchase_date?` (≤ today), `supplier_id?`, `description?` (≤5000), `specifications?` (object of strings, ≤50 keys).

`Vehicle`:

```ts
{ id, stock_number, brand?: {id,name}, model?: {id,name}, year, vin, engine_number, color, mileage,
  transmission, fuel_type, vehicle_type,
  purchase_price?, additional_costs?, total_cost?,   // only with vehicles.view-cost
  selling_price, purchase_date, supplier?: {id,name}|null, branch?: {id,name},
  description, specifications: Record<string,string>|null, status,
  images?: {id,url,is_primary}[], created_at, updated_at }
```

Vehicle status transitions (server-enforced): available → reserved/sold/under_maintenance/transferred; reserved → available/sold; sold → available; under_maintenance → available; transferred → available. Reserved/sold/transferred are set by **workflows** (reservation, sale, transfer), not by the status endpoint.

`VehicleMovement`: `{ id, reference, vehicle?: {id,stock_number}, from_branch?: {id,name}, to_branch?: {id,name}, status: in_transit|completed|cancelled, notes, initiated_by, initiated_at, completed_by, completed_at }`

### 11.6 Suppliers & Purchasing

| Method         | Path                               | 🔒                                       | Request                                                                                                                                                                  | Response                                                                               |
| -------------- | ---------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| GET            | `/suppliers`                       | suppliers.view                           | **S** name, supplier_code, contact_person, phone, email, tax_number · **F** status · **O** name, supplier_code, created_at                                               | paginated `Supplier`                                                                   |
| POST           | `/suppliers`                       | suppliers.create                         | `name`*, `supplier_code?` (auto `SUP…`), `contact_person?`, `phone?`, `email?`, `address?`, `tax_number?` (unique), `status?` (active/inactive), `notes?`                | `Supplier`                                                                             |
| GET/PUT/DELETE | `/suppliers/{id}`                  | suppliers.view/update/delete             |                                                                                                                                                                          | `Supplier` / null                                                                      |
| GET            | `/suppliers/{id}/balance`          | suppliers.view                           | —                                                                                                                                                                        | `{ supplier_id, total_purchases, total_payments, total_refunds, outstanding_balance }` |
| GET            | `/suppliers/{id}/purchases`        | + purchase-orders.view                   | **F** status, payment_status, branch_id · **O** -purchase_date, total_amount · **D** purchase_date                                                                       | paginated `PurchaseOrder`                                                              |
| GET            | `/suppliers/{id}/payments`         | + treasury.view                          | **F** type, category, status · **O** -transaction_date, amount · **D** transaction_date                                                                                  | paginated `TreasuryTransaction`                                                        |
| GET            | `/purchase-orders`                 | purchase-orders.view                     | **S** number, notes, supplier.name · **F** supplier_id, branch_id, status, payment_status · **O** -purchase_date, number, total_amount, created_at · **D** purchase_date | paginated `PurchaseOrder`                                                              |
| POST           | `/purchase-orders`                 | purchase-orders.create                   | see below                                                                                                                                                                | `PurchaseOrder` with items                                                             |
| GET            | `/purchase-orders/{id}`            | purchase-orders.view                     | —                                                                                                                                                                        | `PurchaseOrder` with items                                                             |
| POST           | `/purchase-orders/{id}/cancel`     | purchase-orders.cancel                   | `reason`* (3–255)                                                                                                                                                        | `PurchaseOrder`                                                                        |
| GET            | `/purchase-orders/{id}/payments`   | purchase-orders.view                     | —                                                                                                                                                                        | `TreasuryTransaction[]`                                                                |
| POST           | `/purchase-orders/{id}/payments` ⏱ | purchase-orders.update + treasury.create | `amount`_, `cashbox_id`_, `payment_method`_, `payment_date`_, `reference?`, `notes?`                                                                                     | `{ payment: TreasuryTransaction, purchase_order: PurchaseOrder }`                      |
| POST           | `/purchase-orders/{id}/costs`      | purchase-orders.update                   | `vehicle_id`* (must be in order) + VehicleCost fields                                                                                                                    | cost object                                                                            |

Create purchase order body:

```jsonc
{
  "supplier_id": 1,
  "branch_id": 1,
  "purchase_date": "2026-11-20",
  "payment_method": "bank_transfer", // optional, enabled methods only
  "notes": null,
  "vehicles": [
    {
      // 1..50
      "brand_id": 1,
      "model_id": 3,
      "year": 2025,
      "vin": null,
      "engine_number": null,
      "color": "White",
      "mileage": 0,
      "transmission": "automatic",
      "fuel_type": "petrol",
      "vehicle_type": "sedan",
      "purchase_price": "850000.00",
      "selling_price": "950000.00",
      "description": null,
      "specifications": {},
      "costs": [{ "cost_type": "transportation", "amount": "5000.00", "description": null }], // 0..20
    },
  ],
  "initial_payment": {
    "amount": "200000.00",
    "cashbox_id": 1,
    "payment_method": "cash",
    "reference": null,
  }, // optional
}
```

`PurchaseOrder`: `{ id, number, supplier?: {id,name,supplier_code}, branch?: {id,name}, purchase_date, payment_method, total_amount, paid_amount, remaining_balance, payment_status: unpaid|partially_paid|paid, status, notes, items?: [{ id, purchase_price, vehicle: {id, stock_number, vin, status, additional_costs, total_cost} }], cancelled_at, cancellation_reason, created_at }`

### 11.7 Customers

| Method | Path                        | 🔒               | Request                                                                                                                                       | Response                                                                                                    |
| ------ | --------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET    | `/customers`                | customers.view   | **S** name, customer_code, phone, email · **F** status, branch_id · **O** -created_at, name, customer_code · **D** created_at                 | paginated `Customer`                                                                                        |
| POST   | `/customers`                | customers.create | `name`_, `phone`_ (`^\+?[0-9]{7,15}$`), `branch_id`*, `customer_code?`, `email?`, `national_id?` (14 digits), `address?`, `notes?`, `status?` | `Customer`                                                                                                  |
| GET    | `/customers/{id}`           | customers.view   | `?include=national_id` (needs view-sensitive)                                                                                                 | `Customer`                                                                                                  |
| PUT    | `/customers/{id}`           | customers.update | same fields optional; `branch_id` **prohibited**                                                                                              | `Customer`                                                                                                  |
| DELETE | `/customers/{id}`           | customers.delete | —                                                                                                                                             | null                                                                                                        |
| POST   | `/customers/lookup` ⏱       | customers.create | `national_id`* (14 digits), `branch_id`*                                                                                                      | `Customer` or **404** — looks up an existing customer by national ID and grants the branch access ("claim") |
| GET    | `/customers/{id}/contracts` | customers.view   | **F** status, payment_type · **O** -contract_date, final_amount                                                                               | paginated `SalesContract`                                                                                   |
| GET    | `/customers/{id}/payments`  | customers.view   | **F** type, category, status, related_id · **O** -transaction_date, amount · **D** transaction_date                                           | paginated `TreasuryTransaction`                                                                             |
| GET    | `/customers/{id}/balance`   | customers.view   | —                                                                                                                                             | `{ customer_id, contracts_count, total_contract_amount, total_paid, outstanding_balance }`                  |

`Customer`: `{ id, customer_code, name, phone, email, national_id (masked), address, notes, status, branch?: {id,name}, created_at }`

### 11.8 Sales (contracts & reservations)

| Method | Path                               | 🔒                       | Request                                                                                                                                                                                                                                           | Response                                                                                 |
| ------ | ---------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/sales-contracts`                 | sales-contracts.view     | **S** number, customer.name, customer.phone, vehicle.stock_number, vehicle.vin · **F** status, payment_type, branch_id, customer_id, vehicle_id, sales_employee_id · **O** -contract_date, number, final_amount, created_at · **D** contract_date | paginated `SalesContract`                                                                |
| POST   | `/sales-contracts` ⏱               | sales-contracts.create   | see below                                                                                                                                                                                                                                         | `SalesContract` with `payment_plan`                                                      |
| GET    | `/sales-contracts/{id}`            | sales-contracts.view     | —                                                                                                                                                                                                                                                 | `SalesContract` with `payment_plan`, `status_history`                                    |
| POST   | `/sales-contracts/{id}/cancel` ⏱   | sales-contracts.cancel   | `reason`* (3–255)                                                                                                                                                                                                                                 | `SalesContract`                                                                          |
| GET    | `/sales-contracts/{id}/payments`   | sales-contracts.view     | —                                                                                                                                                                                                                                                 | `{ final_amount, paid_amount, outstanding_amount, transactions: TreasuryTransaction[] }` |
| POST   | `/sales-contracts/{id}/payments` ⏱ | treasury.create + branch | `amount`_, `cashbox_id`_, `payment_method`_, `payment_date`_, `reference?`, `notes?` — **not for installment contracts** (409)                                                                                                                    | `{ receipt: TreasuryTransaction, contract: SalesContract }`                              |
| GET    | `/reservations`                    | reservations.view        | **S** number, customer.name, vehicle.stock_number · **F** status, branch_id, vehicle_id, customer_id · **O** -created_at, expires_at · **D** created_at                                                                                           | paginated `Reservation`                                                                  |
| POST   | `/reservations`                    | reservations.create      | `vehicle_id`_, `customer_id`_, `expires_at?` (future), `notes?`                                                                                                                                                                                   | `Reservation`                                                                            |
| GET    | `/reservations/{id}`               | reservations.view        | —                                                                                                                                                                                                                                                 | `Reservation`                                                                            |
| POST   | `/reservations/{id}/release`       | reservations.cancel      | `reason`*                                                                                                                                                                                                                                         | `Reservation`                                                                            |

Create contract body — three shapes keyed by `payment_type`:

```jsonc
// common
{ "customer_id": 1, "vehicle_id": 5, "sales_employee_id": 2, "contract_date": "2026-11-21",
  "payment_type": "cash" | "installment" | "bank_financing",
  "selling_price": "950000.00", "discount": "10000.00", "notes": null }

// A. cash  → `payment` required; down_payment/installments/bank_financing prohibited
"payment": { "amount": "940000.00", "payment_date": "2026-11-21", "payment_method": "cash", "cashbox_id": 1, "reference": null }

// B. installment
"down_payment": "200000.00",
"down_payment_receipt": { "cashbox_id": 1, "payment_method": "cash", "reference": null },   // required when down_payment > 0
"installment_frequency": "monthly",          // enabled frequencies only
"start_date": "2026-12-21",                  // ≥ contract_date
"number_of_installments": 12,                // 1..240, must equal installments.length
"installments": [{ "amount": "61666.67", "due_date": "2026-12-21" }, ...]

// C. bank_financing
"down_payment": "300000.00",
"down_payment_receipt": { ... },             // required when down_payment > 0
"bank_financing": { "bank_id": 1, "transaction_reference": null, "application_date": "2026-11-21",
                    "expected_amount": "640000.00", "internal_notes": null }
```

> The backend **does not generate** the installment schedule — the client sends every row. The frontend must build the schedule (amounts summing to the financed amount, due dates by frequency) and let the user edit it. Confirm the exact sum/rounding rule with the backend owner (see §13).

`SalesContract`:

```ts
{ id, number, customer?: {id,name,customer_code,phone},
  vehicle?: {id, stock_number, vin, brand: string|null, model: string|null, year},
  branch?: {id,name}, sales_employee?: {id,name,employee_code},
  contract_date, payment_type, selling_price, discount, final_amount, down_payment, paid_amount,
  outstanding_amount, currency, status: active|completed|cancelled, notes, reservation_id,
  payment_plan?: object|null,      // show/create only; shape depends on payment_type
  status_history?: [{from_status,to_status,reason,changed_by,created_at}],
  cancelled_at, cancellation_reason, created_at }
```

`payment_plan` for installment: `{ down_payment, remaining_balance, number_of_installments, installment_frequency, start_date, installments: [...] }`; for bank financing: `{ application_id, number, bank:{id,name}, transaction_reference, application_date, status, expected_amount, approved_amount, received_amount, remaining_amount, ... }`.

`Reservation`: `{ id, number, vehicle?: {id,stock_number,vin}, customer?: {id,name,customer_code}, branch_id, status: active|converted|released, expires_at, notes, sales_contract_id, reserved_by, released_at, release_reason, created_at }`

### 11.9 Installments

| Method | Path                            | 🔒                   | Request                                                                                                                                                                      | Response                                                      |
| ------ | ------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| GET    | `/installments`                 | installments.view    | **S** contract.number, customer.name, customer.phone · **F** status, branch_id, customer_id, sales_contract_id · **O** due_date, amount, installment_number · **D** due_date | paginated `Installment`                                       |
| GET    | `/installments/upcoming`        | installments.view    | `days?` (1–90, default 7) + same list params                                                                                                                                 | paginated `Installment`                                       |
| GET    | `/installments/overdue`         | installments.view    | same list params                                                                                                                                                             | paginated `Installment`                                       |
| GET    | `/installments/{id}`            | installments.view    | —                                                                                                                                                                            | `Installment` with payments                                   |
| GET    | `/installments/{id}/payments`   | installments.view    | —                                                                                                                                                                            | `[{ id, amount, paid_at, status, receipt: TreasuryTransaction | null }]` |
| POST   | `/installments/{id}/payments` ⏱ | installments.collect | `amount`_, `cashbox_id`_, `payment_method`_, `payment_date`_, `reference?`, `notes?`                                                                                         | `{ payment_id, receipt, installment }`                        |

`Installment`: `{ id, installment_number, sales_contract?: {id,number}, customer?: {id,name,customer_code,phone}, branch_id, amount, due_date, paid_amount, remaining_amount, status: pending|partially_paid|paid|overdue|cancelled, payments?: [{id,amount,paid_at,status,receipt_number,treasury_transaction_id}] }`

### 11.10 Bank financing

| Method | Path                                           | 🔒                                | Request                                                                                                                                                                                                            | Response                                                                                           |
| ------ | ---------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| GET    | `/banks`                                       | banks.view or bank-financing.view | —                                                                                                                                                                                                                  | raw `Bank[]` `{ id, name, code, contact_person, phone, email, is_active, created_at, updated_at }` |
| POST   | `/banks`                                       | banks.create                      | `name`* (unique), `code?` (unique ≤20), `contact_person?`, `phone?`, `email?`, `is_active?`                                                                                                                        | `Bank`                                                                                             |
| PUT    | `/banks/{id}`                                  | banks.update                      | same, optional                                                                                                                                                                                                     | `Bank`                                                                                             |
| GET    | `/bank-financing-applications`                 | bank-financing.view               | `pending?=1` · **S** number, transaction_reference, customer.name, contract.number · **F** status, bank_id, branch_id, customer_id · **O** -application_date, expected_amount, created_at · **D** application_date | paginated `BankFinancing`                                                                          |
| GET    | `/bank-financing-applications/{id}`            | bank-financing.view               | —                                                                                                                                                                                                                  | `BankFinancing` with `status_timeline`                                                             |
| POST   | `/bank-financing-applications/{id}/status`     | bank-financing.update             | `status`* ∈ submitted, under_review, additional_documents_required, approved, rejected, cancelled; `approved_amount` required iff approved; `transaction_reference?`, `notes?`                                     | `BankFinancing`                                                                                    |
| GET    | `/bank-financing-applications/{id}/receipts`   | bank-financing.view               | —                                                                                                                                                                                                                  | `TreasuryTransaction[]`                                                                            |
| POST   | `/bank-financing-applications/{id}/receipts` ⏱ | bank-financing.collect            | `amount`_, `cashbox_id`_, `payment_method`_, `payment_date`_, `reference?`, `notes?`                                                                                                                               | `{ receipt, application }`                                                                         |

There is no create endpoint: applications are created by `POST /sales-contracts` with `payment_type=bank_financing`. There is no DELETE for banks.

`BankFinancing`: `{ id, number, sales_contract?: {id,number,final_amount,down_payment}, customer?, vehicle?: {id,stock_number,vin}, bank?: {id,name}, branch_id, transaction_reference, application_date, expected_amount, approved_amount, received_amount, remaining_amount, status, internal_notes?, status_timeline?: [{from_status,to_status,notes,changed_by,created_at}], created_at }`

Manual transitions: new → submitted/cancelled; submitted → under_review/additional_documents_required/approved/rejected/cancelled; under_review → additional_documents_required/approved/rejected/cancelled; additional_documents_required → submitted/under_review/cancelled; approved → cancelled. Funds can be received only when approved/partially_received (partially/fully_received are set automatically).

### 11.11 Treasury

| Method | Path                                    | 🔒                        | Request                                                                                                                                                                                                                                                                       | Response                                     |
| ------ | --------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| GET    | `/cashboxes`                            | cashboxes.view            | **S** name, code · **F** branch_id, status, type · **O** name, code, created_at                                                                                                                                                                                               | paginated `Cashbox` (with `current_balance`) |
| POST   | `/cashboxes`                            | cashboxes.create + branch | `branch_id`_, `name`_, `code`* (alpha_dash unique), `type`* (cash/bank_account), `opening_balance?`, `low_balance_threshold?`, `currency?`, `status?`                                                                                                                         | `Cashbox`                                    |
| GET    | `/cashboxes/{id}`                       | cashboxes.view            | —                                                                                                                                                                                                                                                                             | `Cashbox`                                    |
| PUT    | `/cashboxes/{id}`                       | cashboxes.update          | `name?`, `code?`, `low_balance_threshold?`, `status?` (branch_id/type/opening_balance/currency **prohibited**)                                                                                                                                                                | `Cashbox`                                    |
| GET    | `/cashboxes/{id}/transactions`          | + treasury.view           | **S** number, party_name, reference, description · **F** type, category, status, payment_method · **O** -transaction_date, amount, created_at · **D** transaction_date                                                                                                        | paginated `TreasuryTransaction`              |
| POST   | `/cashboxes/transfer` ⏱                 | treasury.create           | `from_cashbox_id`_, `to_cashbox_id`_ (different), `amount`_, `payment_method`_, `transaction_date`*, `reference?`, `description?`                                                                                                                                             | `{ payment, receipt }`                       |
| GET    | `/treasury-transactions`                | treasury.view             | **S** number, party_name, reference, description · **F** type, category, status, payment_method, cashbox_id, branch_id, party_type, party_id, related_type, related_id · **O** -transaction_date, amount, number, created_at · **D** transaction_date                         | paginated `TreasuryTransaction`              |
| GET    | `/receipts` / `/payments`               | treasury.view             | same as above, pre-filtered by type                                                                                                                                                                                                                                           | paginated                                    |
| GET    | `/treasury-transactions/{id}`           | treasury.view             | —                                                                                                                                                                                                                                                                             | `TreasuryTransaction`                        |
| POST   | `/treasury-transactions/{id}/reverse` ⏱ | treasury.reverse          | `reason`* (3–255)                                                                                                                                                                                                                                                             | reversal `TreasuryTransaction` (201)         |
| POST   | `/receipts` ⏱                           | treasury.create           | manual: `cashbox_id`_, `category?` (other, supplier_refund), `amount`_, `payment_method`_, `transaction_date`_, `party_type`* (customer, supplier, employee, bank, other), `party_id` (required unless other), `party_name` (required if other), `reference?`, `description?` | `TreasuryTransaction`                        |
| POST   | `/payments` ⏱                           | treasury.create           | same; `category?` ∈ other, customer_refund; `sales_contract_id` required iff customer_refund                                                                                                                                                                                  | `TreasuryTransaction`                        |

`Cashbox`: `{ id, name, code, type, branch?: {id,name}, opening_balance, current_balance, low_balance_threshold, currency, status }`

`TreasuryTransaction`: `{ id, number, type: receipt|payment, category, amount, currency, payment_method, transaction_date, cashbox?: {id,name,code}, branch_id, party: {type,id,name}, related: {type,id}|null, reference, description, status: posted|reversed, reversal_of_id, reversed_at, reversal_reason, created_by?: {id,name}, created_at }`

Treasury records are immutable; corrections are done via **reverse**.

### 11.12 Expenses

| Method | Path                       | 🔒                                       | Request                                                                                                                                                                                          | Response                                   |
| ------ | -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| GET    | `/expense-categories`      | expense-categories.view or expenses.view | —                                                                                                                                                                                                | raw `[{ id, name, code, is_active, ... }]` |
| POST   | `/expense-categories`      | expense-categories.create                | `name`* (unique), `code`* (alpha_dash unique), `is_active?`                                                                                                                                      | category                                   |
| PUT    | `/expense-categories/{id}` | expense-categories.update                | same optional                                                                                                                                                                                    | category                                   |
| GET    | `/expenses`                | expenses.view                            | **S** number, description · **F** status, branch_id, expense_category_id, responsible_employee_id, vehicle_id, cashbox_id · **O** -expense_date, amount, number, created_at · **D** expense_date | paginated `Expense`                        |
| POST   | `/expenses`                | expenses.create                          | `expense_category_id`* (active), `description`_, `amount`_, `expense_date`_, `branch_id`_, `responsible_employee_id?`, `payment_method?`, `vehicle_id?`                                          | `Expense` (status pending)                 |
| GET    | `/expenses/{id}`           | expenses.view                            | —                                                                                                                                                                                                | `Expense` with `approval_history`          |
| PUT    | `/expenses/{id}`           | expenses.update                          | same optional, `branch_id` prohibited                                                                                                                                                            | `Expense`                                  |
| DELETE | `/expenses/{id}`           | expenses.delete                          | —                                                                                                                                                                                                | null                                       |
| POST   | `/expenses/{id}/approve`   | expenses.approve                         | `notes?`                                                                                                                                                                                         | `Expense`                                  |
| POST   | `/expenses/{id}/reject`    | expenses.approve                         | `notes`*                                                                                                                                                                                         | `Expense`                                  |
| POST   | `/expenses/{id}/pay` ⏱     | expenses.pay                             | `cashbox_id`_, `payment_method`_, `payment_date`*, `reference?`                                                                                                                                  | `Expense`                                  |

`Expense`: `{ id, number, category?: {id,name,code}, description, amount, expense_date, branch?, responsible_employee?: {id,name}|null, payment_method, cashbox_id, vehicle?: {id,stock_number}|null, status: pending|approved|rejected|paid|cancelled, treasury_transaction_id, approval_history?, created_at }`

### 11.13 HR

| Method         | Path                                 | 🔒                                  | Request                                                                                                                                                                                              | Response                                                                                                                                                |
| -------------- | ------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET            | `/employees`                         | employees.view                      | **S** name, employee_code, phone, email · **F** branch_id, department_id, job_title_id, status · **O** name, employee_code, joining_date, created_at                                                 | paginated `Employee`                                                                                                                                    |
| POST           | `/employees`                         | employees.create + branch           | `name`_, `branch_id`_, `joining_date`_, `salary`_, `employee_code?` (auto `EMP…`), `user_id?` (unique), `department_id?`, `job_title_id?`, `phone?`, `email?`, `national_id?` (14 digits), `status?` | `Employee`                                                                                                                                              |
| GET/PUT/DELETE | `/employees/{id}`                    | employees.view/update/delete        |                                                                                                                                                                                                      | `Employee` / null                                                                                                                                       |
| GET            | `/attendances`                       | attendance.view                     | **F** employee_id, status · **O** -date, created_at · **D** date                                                                                                                                     | paginated raw attendance `{ id, employee_id, date, check_in, check_out, status, notes, recorded_by, employee: {id,name,employee_code,branch_id}, ... }` |
| POST           | `/attendances`                       | attendance.create + employee branch | `employee_id`_, `date`_ (≤ today, unique per employee), `check_in?` (H:i), `check_out?` (H:i, after check_in), `status`* (present/absent/late/leave), `notes?`                                       | attendance                                                                                                                                              |
| PUT            | `/attendances/{id}`                  | attendance.update                   | `check_in?`, `check_out?`, `status?`, `notes?` (employee_id/date prohibited)                                                                                                                         | attendance                                                                                                                                              |
| GET            | `/hr/departments` · `/hr/job-titles` | hr-setup.view or employees.view     | —                                                                                                                                                                                                    | `[{ id, name, description?, employees_count }]`                                                                                                         |
| POST           | `/hr/{type}`                         | hr-setup.create                     | `name`* (unique), `description?` (departments only)                                                                                                                                                  | item                                                                                                                                                    |
| PUT            | `/hr/{type}/{id}`                    | hr-setup.update                     | same                                                                                                                                                                                                 | item                                                                                                                                                    |
| DELETE         | `/hr/{type}/{id}`                    | hr-setup.delete                     | —                                                                                                                                                                                                    | null                                                                                                                                                    |

`Employee`: `{ id, employee_code, name, user_id, branch?: {id,name}, department?: {id,name}|null, job_title?: {id,name}|null, phone, email, joining_date, salary?, status: active|on_leave|terminated, created_at }` (`national_id` is accepted but not returned.)

### 11.14 Commissions

| Method | Path                                | 🔒                               | Request                                                                                                                                                | Response                                                                                                                                                             |
| ------ | ----------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/commission-rules`                 | commission-rules.view            | **S** name · **F** is_active, type, branch_id, payment_type · **O** -effective_from, name, version                                                     | paginated raw rule `{ id, name, type, value, branch_id, payment_type, effective_from, effective_to, is_active, version, supersedes_id, created_by, branch: {id,name} | null }` |
| POST   | `/commission-rules`                 | commission-rules.create          | `name`_, `type`_ (fixed/percentage), `value`* (>0, ≤100 if percentage, 4 decimals), `effective_from`*, `effective_to?`, `branch_id?`, `payment_type?`  | rule                                                                                                                                                                 |
| PUT    | `/commission-rules/{id}`            | commission-rules.update          | same optional — **creates a new version** (409 if rule inactive)                                                                                       | new rule version                                                                                                                                                     |
| POST   | `/commission-rules/{id}/deactivate` | commission-rules.update          | —                                                                                                                                                      | rule                                                                                                                                                                 |
| GET    | `/commissions`                      | commissions.view                 | **S** contract.number, employee.name · **F** status, employee_id, branch_id, sales_contract_id · **O** -created_at, amount, paid_at · **D** created_at | paginated `Commission`                                                                                                                                               |
| GET    | `/commissions/{id}`                 | commissions.view                 | —                                                                                                                                                      | `Commission`                                                                                                                                                         |
| POST   | `/commissions/{id}/pay` ⏱           | commissions.pay                  | `cashbox_id`_, `payment_method`_, `payment_date`*, `reference?`                                                                                        | `Commission`                                                                                                                                                         |
| POST   | `/sales-contracts/{id}/commission`  | commission-rules.create + branch | —                                                                                                                                                      | `Commission` (201) or 409 `no_commission`                                                                                                                            |

`Commission`: `{ id, sales_contract?: {id,number,contract_date,status}, employee?: {id,name,employee_code}, branch_id, commission_rule_id, rule_snapshot: {type,value,base}, base_amount, amount, status: pending|paid|cancelled, treasury_transaction_id, paid_at, cancelled_at, cancellation_reason, contract_cancelled_after_payment? }`

### 11.15 Documents

| Method | Path                       | 🔒                               | Request                                                                                 | Response              |
| ------ | -------------------------- | -------------------------------- | --------------------------------------------------------------------------------------- | --------------------- |
| GET    | `/documents`               | documents.view + parent access   | `documentable_type`_, `documentable_id`_ (query)                                        | `Document[]`          |
| POST   | `/documents` ⏱             | documents.create + parent access | multipart: `documentable_type`_, `documentable_id`_, `name`_, `document_type`_, `file`* | `Document`            |
| GET    | `/documents/{id}`          | documents.view                   | —                                                                                       | `Document`            |
| GET    | `/documents/{id}/download` | documents.view                   | —                                                                                       | binary (attachment)   |
| GET    | `/documents/{id}/preview`  | documents.view                   | —                                                                                       | binary (inline) / 415 |
| DELETE | `/documents/{id}`          | documents.delete                 | —                                                                                       | null                  |

`documentable_type` ∈ vehicle, purchase_order, sales_contract, customer, supplier, bank_financing_application, employee, expense.
`document_type` ∈ contract, invoice, receipt, national_id, driving_license, vehicle_license, registration, inspection_report, bank_document, photo, other.

`Document`: `{ id, name, document_type, related: {type,id}, original_name, mime_type, size (bytes), previewable, uploaded_by: {id,name}, uploaded_at }`

### 11.16 Notifications (current user only)

| Method | Path                          | Request                                             | Response                 |
| ------ | ----------------------------- | --------------------------------------------------- | ------------------------ |
| GET    | `/notifications`              | `unread?=1`, `per_page?` (≤100, default 20), `page` | paginated `Notification` |
| GET    | `/notifications/unread-count` | —                                                   | `{ unread: number }`     |
| POST   | `/notifications/{uuid}/read`  | —                                                   | `Notification`           |
| POST   | `/notifications/read-all`     | —                                                   | `{ marked: number }`     |
| GET    | `/notifications/preferences`  | —                                                   | `[{ type, enabled }]`    |
| PUT    | `/notifications/preferences`  | `preferences: [{ type, enabled }]`*                 | `[{ type, enabled }]`    |

`Notification`: `{ id (uuid), type, title (localized), message (localized), data: Record<string,unknown>, subject: {type,id}|null, read_at, created_at }`

### 11.17 Dashboard (`dashboard.view`)

All accept `date_from?`, `date_to?`, `branch_id?` (must be accessible; narrows only). Results are cached server-side.

| Path                       | Data keys                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /dashboard/overview`  | `vehicles: { total, available, sold, reserved, under_maintenance, in_transit }`, `sales: { contracts, total_sales }`, `total_collections`, `outstanding_customer_balances`, … |
| `GET /dashboard/sales`     | `monthly`, `by_branch`, `by_brand`, `by_payment_type` (arrays of aggregates)                                                                                                  |
| `GET /dashboard/inventory` | `by_status: [{status,count}]`, `by_branch`, `by_brand`                                                                                                                        |
| `GET /dashboard/financial` | `monthly_receipts_vs_payments`, `installment_collection`, …                                                                                                                   |
| `GET /dashboard/tables`    | `recent_sales`, `latest_purchases`, `upcoming_installments`, `overdue_payments`, `recent_transactions`, `recent_activities` (10 rows each)                                    |

> Exact row shapes are raw query-builder rows; capture them from a running backend before typing them strictly (§13).

### 11.18 Reports (`reports.view` + category permission)

| Method | Path                                                                  | Request                                                                                                                                                       | Response                                                                                 |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/reports`                                                            | —                                                                                                                                                             | `{ [category]: string[] }` available types                                               |
| GET    | `/reports/{category}`                                                 | `type?` (default first), `date_from?`, `date_to?`, `branch_id?`, `employee_id?`, `customer_id?`, `status?`, `search?`, `per_page?` (≤100, default 25), `page` | `{ report: { category, type, title, columns: {key: label} }, items: Row[], pagination }` |
| POST   | `/reports/{category}/export` (throttle `exports`, + `reports.export`) | `type`_, `format`_ (xlsx/pdf), same filters                                                                                                                   | **202** `ReportExport`                                                                   |
| GET    | `/report-exports/{id}`                                                | owner only                                                                                                                                                    | `ReportExport`                                                                           |
| GET    | `/report-exports/{id}/download`                                       | owner + completed                                                                                                                                             | binary                                                                                   |

| Category     | Extra permission     | Types                                                                                                       |
| ------------ | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| inventory    | vehicles.view        | current, available, sold, movements, profitability                                                          |
| sales        | sales-contracts.view | contracts, daily, monthly, by_branch, by_employee, by_brand, by_payment_type                                |
| installments | installments.view    | upcoming, overdue, collected, outstanding, customer_payment_history                                         |
| treasury     | treasury.view        | daily_receipts, daily_payments, cashbox_balances, customer_balances, supplier_balances, branch_transactions |
| expenses     | expenses.view        | by_category, by_branch, monthly                                                                             |
| commissions  | commissions.view     | employee, paid, pending                                                                                     |

Reports are **self-describing** (`columns` map) → one generic table component can render all of them. Column labels are English-only strings from the backend (not localized).

`ReportExport`: `{ id, category, type, format, status: queued|processing|completed|failed, rows, error, download_url, created_at, completed_at }`

### 11.19 Activity log (`activity-logs.view`)

| Method | Path             | Request                                                                                                                                       | Response                         |
| ------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| GET    | `/activity-logs` | **S** action, module, description · **F** module, action, user_id, branch_id, subject_type, subject_id · **O** -created_at · **D** created_at | paginated `{ id, user: {id,name} | null, module, action, subject: {type,id} | null, branch_id, old_values, new_values, description, ip_address, created_at }` |

---

## 12. Enums & lookup values

| Enum                                | Values                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PaymentMethod                       | cash, bank_transfer, cheque, card, mobile_wallet (only **enabled** ones are valid — `GET /settings/lookups`)                                                                                            |
| Installment frequency               | monthly, quarterly, semi_annual, annual, custom (enabled subset in lookups)                                                                                                                             |
| VehicleStatus                       | available, reserved, sold, under_maintenance, transferred                                                                                                                                               |
| Transmission                        | automatic, manual, cvt, dct                                                                                                                                                                             |
| FuelType                            | petrol, diesel, hybrid, electric, natural_gas                                                                                                                                                           |
| VehicleType                         | sedan, hatchback, suv, crossover, pickup, van, coupe, convertible, minibus, other                                                                                                                       |
| VehicleCostType                     | transportation, maintenance, inspection, licensing, registration, repairs, other                                                                                                                        |
| MovementStatus                      | in_transit, completed, cancelled                                                                                                                                                                        |
| PO PaymentStatus                    | unpaid, partially_paid, paid                                                                                                                                                                            |
| PaymentType (sale)                  | cash, installment, bank_financing                                                                                                                                                                       |
| ContractStatus                      | active, completed, cancelled                                                                                                                                                                            |
| ReservationStatus                   | active, converted, released                                                                                                                                                                             |
| InstallmentStatus                   | pending, partially_paid, paid, overdue, cancelled                                                                                                                                                       |
| FinancingStatus                     | new, submitted, under_review, additional_documents_required, approved, rejected, partially_received, fully_received, cancelled                                                                          |
| TransactionType                     | receipt, payment                                                                                                                                                                                        |
| TransactionCategory                 | sale_payment, down_payment, installment_payment, bank_financing, supplier_payment, vehicle_cost, expense, commission, customer_refund, supplier_refund, cashbox_transfer, reversal, other               |
| TransactionStatus                   | posted, reversed                                                                                                                                                                                        |
| Cashbox type / status               | cash, bank_account / active, inactive                                                                                                                                                                   |
| ExpenseStatus                       | pending, approved, rejected, paid, cancelled                                                                                                                                                            |
| AttendanceStatus                    | present, absent, late, leave                                                                                                                                                                            |
| EmploymentStatus                    | active, on_leave, terminated                                                                                                                                                                            |
| CommissionType / Status             | fixed, percentage / pending, paid, cancelled                                                                                                                                                            |
| Branch / Customer / Supplier status | active, inactive                                                                                                                                                                                        |
| NotificationType                    | installment_upcoming, installment_overdue, sales_contract_created, vehicle_reserved, vehicle_transfer, bank_financing_pending, cashbox_low_balance, approval_pending, payment_recorded, system_activity |
| Locales                             | ar, en                                                                                                                                                                                                  |

Enum **values are returned untranslated** (snake_case keys). The frontend owns the ar/en labels for them.

---

## 13. Known gaps, inconsistencies & open questions

| #   | Topic                       | Finding                                                                                                    | Proposed handling / question                                                                                                                                                                                                               |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Token storage               | Only Bearer tokens; no httpOnly cookie option.                                                             | **Decision:** keep token in memory + `localStorage` (survives reload, XSS exposure) vs `sessionStorage` (per tab). Recommend `localStorage` + strict CSP + no `dangerouslySetInnerHTML`, or ask backend to enable Sanctum SPA cookie auth. |
| 2   | Dev port / CORS             | Default allowed origin is `http://localhost:3000`.                                                         | Use Vite proxy in dev, or run Vite on port 3000.                                                                                                                                                                                           |
| 3   | Missing docs                | `docs/API.md`, `ARCHITECTURE.md`, `DATABASE.md` referenced but absent.                                     | This file is the working contract; ask backend owner if docs exist elsewhere.                                                                                                                                                              |
| 4   | Missing tests               | No backend `tests/` in repo despite README.                                                                | Ask whether tests live in another branch.                                                                                                                                                                                                  |
| 5   | Installment schedule        | Client must send all installment rows; sum/rounding rule not documented in the request.                    | Confirm: must `sum(installments.amount) == final_amount - down_payment`? Who handles the rounding remainder (last installment)?                                                                                                            |
| 6   | Dashboard/report row shapes | Raw SQL rows; not described by Resources.                                                                  | Capture real payloads from a running backend (seeded) before typing.                                                                                                                                                                       |
| 7   | Mixed timestamp formats     | Resources use `+02:00` ISO; raw models use `.000000Z`.                                                     | Single date parser handles both.                                                                                                                                                                                                           |
| 8   | Inconsistent error shapes   | Some `abort()` calls return `errors: null` for 409/422.                                                    | Error normalizer falls back to `message`.                                                                                                                                                                                                  |
| 9   | Catalog reads unprotected   | `GET /vehicle-brands`, `/vehicle-models` have no permission check; `vehicle-catalog.view` is unused there. | Fine for selects; flag to backend.                                                                                                                                                                                                         |
| 10  | Report column labels        | English only.                                                                                              | Frontend maps `columns` keys to translations, falls back to backend label.                                                                                                                                                                 |
| 11  | Authenticated binaries      | download/preview/export need Bearer header.                                                                | Blob download helper.                                                                                                                                                                                                                      |
| 12  | No realtime                 | No broadcasting.                                                                                           | Poll unread count.                                                                                                                                                                                                                         |
| 13  | AGENTS.md                   | Contains Laravel Boost bootstrap instructions (install PHP/Boost).                                         | Not applicable to frontend; backend is read-only — ignored.                                                                                                                                                                                |
| 14  | Product scope               | 21 modules.                                                                                                | Need your decision on which modules ship first (see roadmap).                                                                                                                                                                              |
| 15  | Brand assets                | No logo in the backend repo (only default `favicon.ico`).                                                  | Please provide the official logo (SVG preferred).                                                                                                                                                                                          |
