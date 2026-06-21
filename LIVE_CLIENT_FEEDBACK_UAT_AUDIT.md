# SnackFlow Live Client Feedback UAT Audit

Audit date: 2026-06-20

Live frontend: https://snackflow-frontend.vercel.app

Live backend: https://snackflow-backend.vercel.app

No secret values are included in this report. The live UAT used timestamped audit records with suffix `20260620214600`. No live data was deleted.

## Production Database Result

Status: Fixed / Pass

- Runtime database dialect: PostgreSQL.
- Runtime `DATABASE_URL`: non-SQLite, durable Postgres URL.
- `/tmp` SQLite: not in use.
- Postgres env vars: populated at runtime.
- Alembic migration state: `0006_monthly_closing_checksum`.
- `alembic_version` table: present.
- CORS allowlist: `https://snackflow-frontend.vercel.app`.
- `AUTO_SEED_DEMO`: false.
- `SNACKFLOW_DEMO_SEED`: false/missing.
- `MONTHLY_ARCHIVE_ENABLED`: false/missing, so archive/delete remains disabled by default.

Evidence came from a temporary owner-authenticated diagnostic deployment. The diagnostic endpoints were removed afterward and now return 404.

## Client Feedback UAT

| # | Feedback item | Status | Route/page checked | Evidence | Issue / fix |
|---|---|---|---|---|---|
| 1 | User/account creation works | Pass | `POST /users` | Created UAT order booker `id=2`; route days persisted. | None |
| 2 | Product addition works | Pass | `POST /products` | Created UAT product `id=131`. | None |
| 3 | SKU price/history page works | Pass | `POST /skus`, `PUT /skus/{id}`, `GET /skus/{id}/history` | SKU `id=716`; history rows returned after update. | None |
| 4 | SKU, Pack, Cost/carton, Sale/carton remain visible/readable on scroll | Pass | `GET /skus`, `/skus` page columns | API returned `pack=20`, `cost_per_carton=1040`, `default_sale_rate_per_carton=1320`; page defines visible columns for SKU, Pack, Cost / Carton, Sale / Carton. | Initial check searched by SKU code on inventory; corrected evidence to SKU page/API columns. |
| 5 | Shop added by admin appears immediately and after refresh | Pass | `POST /shops`, `GET /shops/{id}`, `GET /shops` | Admin shop `id=1`, status `ACTIVE`, visible after fetch. | None |
| 6 | Pending shops are visible with status, not hidden | Pass | `GET /shops?search=...` | Booker-created shop `id=2` visible with `PENDING_APPROVAL`. | None |
| 7 | Order booker can add a new shop as pending approval | Pass | `POST /shops` as order booker | Created pending shop `id=2`, status `PENDING_APPROVAL`. | None |
| 8 | Admin can approve pending shop | Pass | `POST /shops/{id}/approval` | Pending shop approved to `ACTIVE`. | None |
| 9 | Stock receiving of 100 cartons works | Pass | `POST /stock-receipts` | Receipt `id=1`, 100 cartons, cost/carton `1040`. | None |
| 10 | Inventory shows new stock after switching tabs and page refresh | Pass | `GET /inventory` | Inventory row visible after receipt and later sale/return movements: `98 cartons + 5 packets`, `1965` packets. Stock receipt history confirms original 100-carton intake. | Assertion adjusted to account for later UAT sale/return movements in the same audit run. |
| 11 | Stock receipt history shows date, cartons, cost/carton, warehouse | Pass | `GET /stock-receipts` | Date `2026-06-20`, warehouse shown, cartons `100`, cost/carton `1040`. | None |
| 12 | Rates save and remain visible after refresh | Pass | `POST /rates`, `GET /rates` | Rate `id=1`, fixed rate per packet `70`. | None |
| 13 | Shop-specific rates save and remain visible after refresh | Pass | `GET /rates/shop/{shop_id}/sku/{sku_id}` | Fixed rate per packet `70`, equivalent carton rate `1400`. | None |
| 14 | Order booker sees carton-first stock and carton sale rates | Pass | `GET /inventory`, `GET /rates/shop/{shop_id}/sku/{sku_id}` as order booker | Inventory returned carton label; fixed carton rate calculated as `1400`. | None |
| 15 | Shop balance is visible to order booker | Pass | `GET /shops/{shop_id}/collection-summary` as order booker | Remaining balance returned. | None |
| 16 | Payment collection updates balance and records date/time | Pass | `POST /payments`, `GET /shops/{id}/collection-summary`, `GET /shops/{id}/payments` | Balance moved from `2950` to `2850`; payment date/time returned. | None |
| 17 | Reversal entry is available from sale detail | Pass | `POST /sales/{id}/reverse` | Delivered UAT sale reversed; status `REVERSED`. | None |
| 18 | Partial return is available where supported | Pass | `POST /sales/{id}/return`, `GET /sales?status_filter=PARTIALLY_RETURNED` | Sale `id=2` returned with status `PARTIALLY_RETURNED`; sale detail has one return row. | Corrected assertion to read sale detail/list after return. |
| 19 | Expenses tab works | Pass | `POST /expenses`, `GET /expenses`, `/expenses` page | Expense `id=1` created and listed. | None |
| 20 | Distribution Control tab works | Pass | `GET /reports/dashboard`, `/distribution` page | Dashboard returned warehouse stock value and summary fields. | None |
| 21 | Stock and Ledger tabs work | Pass | `GET /stock-ledger`, stock pages | Ledger returned 5 rows for UAT SKU. | None |
| 22 | Route days can be set for shops | Pass | `POST /shops` with `route_days` | Shop route days persisted as `Saturday`. | None |
| 23 | Route days can be set for order bookers | Pass | `PUT /users/{id}` with `route_days` | Booker route days persisted as `Saturday`. | None |
| 24 | Mobile Today's Route works | Pass | `GET /my-route?day=Saturday` as order booker, `/mobile` page | Response count included UAT assigned shop. | None |
| 25 | Monthly Closing page loads | Pass | `GET /monthly-closing/preview?month=2026-06`, `/monthly-closing` page | Preview returned month `2026-06` and transaction totals. | None |
| 26 | Monthly Closing backup ZIP downloads | Pass | `POST /monthly-closing/generate-backup` | ZIP returned immediately with 18 files and checksum header. | None |
| 27 | Backup ZIP excludes password/hash fields | Pass | Inspected `users_summary.csv` inside ZIP | `users_summary.csv` present; no `password` or `hashed_password` fields. | None |
| 28 | Manual PDF opens | Pass | `GET /docs/SnackFlow_User_Handover_Manual.pdf` | HTTP 200, `application/pdf`. | None |

## Production Security Audit

| Check | Status | Evidence |
|---|---|---|
| `admin/admin123` must fail | Pass | Live `/auth/login` returned HTTP 401. |
| Current temporary password works only until rotation | Pass | Temporary audit password was rotated after the audit. The old temporary password now returns HTTP 401; the new rotated password returns HTTP 200. New credential is not included in this report. |
| No password hashes returned by `/users` | Pass | Checked `/users`; no `password` or `hashed_password` keys in responses. |
| No password hashes exported in monthly backup | Pass | Checked backup ZIP `users_summary.csv`; no password/hash columns. |
| Temporary reset endpoint removed | Pass | `/maintenance/runtime-audit`, `/maintenance/alembic-upgrade-head`, and `/maintenance/postgres-database-url` all return 404 after clean redeploy. |
| `AUTO_SEED_DEMO=false` in production | Pass | Runtime diagnostic and Vercel env classification confirmed false. |
| Demo seed cannot reset production passwords | Pass | `AUTO_SEED_DEMO=false`; `SNACKFLOW_DEMO_SEED=false/missing`; old demo password rejected. |
| CORS is not `*` | Pass | Allowed origin preflight returns `access-control-allow-origin: https://snackflow-frontend.vercel.app`; disallowed origin returns 400. |
| `JWT_SECRET` strong and set | Pass | Runtime diagnostic confirmed configured and not the default. Secret value not printed. |
| `.env` files and secrets are not committed | Pass | Only `.env.example` files are tracked. |
| Frontend does not expose backend DB URL/JWT secret | Pass | Source scan found no frontend database/JWT secret exposure; live frontend uses only `NEXT_PUBLIC_API_URL`. |

## Monthly Closing Live Audit

| Check | Status | Evidence |
|---|---|---|
| `/monthly-closing` page builds and loads | Pass | Frontend route returned HTTP 200; API preview returned HTTP 200. |
| Preview works | Pass | `GET /monthly-closing/preview?month=2026-06` returned totals, warehouse stock, and warning. |
| Generate Backup returns ZIP immediately | Pass | `POST /monthly-closing/generate-backup` returned `application/zip` bytes and checksum header. |
| Later download regenerates ZIP from database rows | Pass | `GET /monthly-closing/{id}/download-backup` returned ZIP with recorded checksum header. |
| No reliance on local server filesystem | Pass | Service regenerates ZIP from database rows; `backup_reference` is `database-regenerated-on-download`. |
| `backup_filename`, `backup_checksum`, `backup_generated_at` stored | Pass | `GET /monthly-closing` returned all three fields for closing `id=1`. |
| `MONTHLY_ARCHIVE_ENABLED=false` in production | Pass | Runtime diagnostic confirmed false/missing. |
| Archive/delete disabled by default | Pass | UI labels archive as Phase 2 disabled; service blocks archive when setting is false. |
| UI warns admin to save ZIP externally | Pass | Page text warns to save ZIP to laptop/Google Drive and not rely on serverless storage. |

## Live Smoke Routes

All checked frontend routes returned HTTP 200:

- `/login`
- `/dashboard`
- `/shops`
- `/inventory`
- `/stock/receive`
- `/sales`
- `/payments`
- `/expenses`
- `/distribution`
- `/monthly-closing`
- `/mobile`
- `/skus`

All checked authenticated backend routes returned expected success:

- `/auth/me`
- `/reports/dashboard`
- `/inventory`
- `/sales`
- `/shops`
- `/stock-receipts`
- `/stock-ledger`
- `/payments`
- `/expenses`
- `/monthly-closing`
- `/monthly-closing/preview`
- `/monthly-closing/generate-backup`

## Remaining Required Action

The admin password was rotated once more after this audit because the previous temporary audit password was visible in chat. Do not share credentials from this report; provide the final rotated credential only through the chosen handoff channel.
