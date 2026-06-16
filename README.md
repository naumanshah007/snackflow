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

The backend container runs migrations and the seed script automatically.

- Frontend: http://localhost:3000 or http://127.0.0.1:3000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

Default seeded users:

- Owner: `admin` / `admin123`
- Booker 1: `booker1` / `booker123`
- Booker 2: `booker2` / `booker123`

## Manual Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

For quick local testing without Postgres, leave `DATABASE_URL` unset and the backend will use `sqlite:///./snackflow.db`.

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

Current backend tests also cover carton-to-packet conversion, warehouse separation, insufficient stock, cancelled sales, partial returns, fixed/last sale rates, order-booker scope, expenses and profit reports, GPS storage, and item-sales reporting.

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

## App vs Link, and Costs

SnackFlow can run as a **web app through a secure link**. Order bookers can use it from a **mobile browser**, and it can be installed as a **PWA / mobile-app-style shortcut** (a `manifest.json` is included). A separate **Android / Play Store app** can be built later if required — it is optional future work.

Online usage may require **hosting / database / storage / domain** cost depending on the deployment choice (for example a cloud server + managed Postgres + domain). **Local-only** use can avoid hosting cost but limits remote access for field order bookers.

## Notes

- Confirmed sales should be reversed instead of edited or deleted.
- Expense deletion is implemented as a void flag to preserve history.
- Partial returns are implemented through `POST /sales/{sale_id}/return`.
- Reversal and partial-return UI live on the Sales screen (open a sale → View).
