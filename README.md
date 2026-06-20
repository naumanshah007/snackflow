# SnackFlow — Distribution Management System for Zaib Brothers

SnackFlow is a production-ready MVP for snack distribution: warehouse-specific stock, editable SKU pricing with audit history, shop ledgers, sales confirmation/reversal, partial returns, payments, expenses, reports, GPS shops, and a mobile order-booker flow.

**SnackFlow** is the system/product name; **Zaib Brothers** is the business name.

## Carton-First UI

The business thinks and sells in **cartons**. Stock is stored internally in **packets** for accuracy, and every user-facing surface (inventory, stock receive, stock ledger, sales, mobile order booker, SKU prices, reports, CSV exports) is carton-first:

```
cartons       = floor(quantity_packets / pack_quantity)   ->  "12 cartons + 5 pkts"
loose_packets = quantity_packets % pack_quantity
cost_per_carton      = cost_per_packet      * pack_quantity
sale_rate_per_carton = sale_rate_per_packet * pack_quantity
```

The 2026-06-15 client feedback and the fixes applied are recorded in [`CLIENT_FEEDBACK_2026_06_15.md`](CLIENT_FEEDBACK_2026_06_15.md).

## Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, Recharts
- Backend: FastAPI, SQLModel/SQLAlchemy, JWT auth
- Database: PostgreSQL
- Migrations: Alembic
- Local orchestration: Docker Compose

## Quick Start With Docker

```bash
docker compose up --build
```

The backend container runs migrations and the seed script automatically with `SNACKFLOW_DEMO_SEED=true` for local demo data.

- Frontend: http://localhost:3000 or http://127.0.0.1:3000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

Default seeded users:

- Owner: `admin` / `admin123`
- Booker 1: `booker1` / `booker123`
- Booker 2: `booker2` / `booker123`

These credentials are for local/demo use only.

## Manual Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
SNACKFLOW_DEMO_SEED=true python -m app.seed
uvicorn app.main:app --reload
```

For quick local testing without Postgres, leave `DATABASE_URL` unset and the backend will use `sqlite:///./snackflow.db`.

## Production Seed Safety

The seed script does **not** reset existing user passwords unless demo seeding is explicitly enabled with `SNACKFLOW_DEMO_SEED=true` or `ENVIRONMENT=development`.

Production setup rules:

- Never enable `SNACKFLOW_DEMO_SEED` in production.
- Never run demo seed reset against production data.
- Keep `AUTO_SEED_DEMO=false` in production unless you intentionally want startup to run the production-safe seed path.
- If production has no users, create the first owner admin by setting `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` before running `python -m app.seed`.
- Use a strong `INITIAL_ADMIN_PASSWORD`; do not use `admin123` or `booker123`.
- If demo credentials were ever used during setup, change the admin password immediately from the app.

## Manual Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Core Business Rules Implemented

- Inventory is stored by `warehouse_id` and `sku_id`.
- Stock receipts convert cartons/bundles to packets.
- `inventory_balances` stores current quantity and average cost.
- `stock_ledger` records every stock movement.
- Delivered sales create `SALE_OUT` entries and reduce stock.
- Booked/draft sales do not reduce stock.
- Reversals create reversal ledger entries and add stock back.
- Shop balances are maintained through `shop_ledger`.
- Payments reduce shop pending balance.
- Last sale rate is saved by shop and SKU.
- SKU and shop rate edits write audit logs visible in the UI.
- Expenses reduce net profit but not gross profit.
- Order bookers are scoped to their assigned warehouse and shops.

## Main Routes

Admin:

- `/dashboard`
- `/distribution` (Distribution Control: stock, receive, ledger overview)
- `/products`
- `/skus`
- `/rates`
- `/warehouses`
- `/inventory`
- `/stock/receive`
- `/stock/ledger`
- `/shops`
- `/sales`
- `/payments`
- `/expenses`
- `/reports`
- `/monthly-closing`
- `/users`
- `/settings`

Mobile:

- `/mobile`

## Tests

```bash
cd backend
pytest
```

The included tests cover the highest-risk path: stock receipt, delivered sale stock deduction, shop ledger update, sale reversal, and payment posting.

Current backend tests also cover carton-to-packet conversion, warehouse separation, insufficient stock, cancelled sales, partial returns, fixed/last sale rates, order-booker scope, expenses and profit reports, GPS storage, item-sales reporting, seed safety, and monthly closing backup/carry-forward behavior.

## Manual and Audit Docs

- Audit report: `AUDIT_REPORT.md`
- Original written requirement: `docs/requirements/original_written_requirement.md`
- Original voice transcript: `docs/requirements/original_voice_transcript.md`
- User manual Markdown: `docs/manual/SnackFlow_User_Handover_Manual.md`
- User manual HTML: `docs/manual/SnackFlow_User_Handover_Manual.html`
- User manual PDF: `public/docs/SnackFlow_User_Handover_Manual.pdf`

Generate the PDF again with:

```bash
python3 scripts/generate_manual_pdf.py
```

## Main Business Workflows

- Admin creates warehouses, users, SKUs, shops, and rate rules.
- Warehouse manager receives stock by carton/bundle/packet; stock is stored in packets.
- Order booker logs into `/mobile`, selects assigned shop, creates order, records payment, or logs shop closed/no order.
- Delivered sales subtract stock and create shop ledger entries.
- Payments reduce shop pending balances.
- Reversals and partial returns preserve original sale history and create correcting ledger entries.
- Expenses reduce net profit but do not affect gross profit.
- Reports show sales, item movement, pending bills, stock, payments, visits, expenses, and profit.

## Order Booker New Shops

Order bookers can register new shops from the mobile app. Such shops are scoped automatically to the booker's assigned warehouse and the booker, and are created with status `PENDING_APPROVAL`. An admin/accountant approves (or rejects) via `POST /shops/{id}/approval`; approved shops become active. Admin-created shops are active immediately. The migration `0003_shop_status` adds the `status` column (defaults `ACTIVE`, so nothing existing is hidden).

## Route Days (Weekly Route Planning)

Each shop and each order booker can store **route days** (Monday–Sunday, multi-select):

- **Admin** sets a shop's route days on the Shops page (route-day chips on the create/edit form) and an order booker's working days on the Users page.
- The **Shops page** shows route-day chips on every shop card and a **Route day filter** to view "shops by route day"; shops with no route days show "No route days".
- The **mobile order booker dashboard** shows a **Today's Route** card listing the booker's active shops whose route day matches today, with each shop's pending balance; tap a shop to select it for an order.
- API: `GET /shops?route_day=Monday` filters, `GET /my-route?day=Monday` returns the current booker's route for a day (defaults to today), and `GET /shops-by-route-day` returns shops grouped by day (empty ones under `Unassigned`).
- Storage: `Shop.route_days` and `User.route_days` are JSON lists. The migration `0004_route_days` adds both columns (default empty list, so nothing existing is hidden). Seed data ships sample route days for the demo bookers and shops.

## Monthly Closing & Archive

Monthly Closing helps Zaib Brothers stay within free-tier database limits without blindly deleting financial or stock history.

Phase 1 is implemented:

- Admin opens `/monthly-closing` and selects a month.
- Preview shows total sales, payments received, expenses, gross profit, net profit, outstanding shop balance, warehouse-wise closing stock, and transaction counts.
- Generate Backup creates a ZIP in memory and streams it immediately to the admin. The app stores the backup filename, SHA-256 checksum, and generated timestamp in `monthly_closings`, but it does not rely on Vercel/serverless local disk for permanent storage.
- The ZIP contains CSV exports for sales, sale items, payments, expenses, shop ledger, stock ledger, stock receipts/items, current inventory balances, shops, SKUs, product/warehouse masters, users summary without password hashes, and monthly summary.
- Download and save the ZIP immediately to laptop/Google Drive. Later download is regenerated from database rows for that month, so do not treat server local storage as a backup.
- Close Month records a `monthly_closings` row and creates next-month opening balance rows in `monthly_shop_opening_balances` and `monthly_inventory_opening_balances`.
- Archive/delete is Phase 2 and disabled by default with `MONTHLY_ARCHIVE_ENABLED=false`.

Strong warning: **This action should only be done after downloading backup. It cannot be undone unless backup is restored.**

Never blindly delete ledger history. In Phase 2, prefer archive tables or marked-as-archived rows over hard delete, and never remove users, warehouses, active shops, active SKUs/products, current inventory balances, current shop balances, monthly closing summaries, or related audit records.

## App vs Link, and Costs

SnackFlow can run as a **web app through a secure link**. Order bookers can use it from a **mobile browser**, and it can be installed as a **PWA / mobile-app-style shortcut** (a `manifest.json` is included). A separate **Android / Play Store app** can be built later if required — it is optional future work.

Online usage may require **hosting / database / storage / domain** cost depending on the deployment choice (for example a cloud server + managed Postgres + domain). **Local-only** use can avoid hosting cost but limits remote access for field order bookers.

## Notes

- Confirmed sales should be reversed instead of edited or deleted.
- Expense deletion is implemented as a void flag to preserve history.
- Partial returns are implemented through `POST /sales/{sale_id}/return`.
- Reversal and partial-return UI live on the Sales screen (open a sale → View).
