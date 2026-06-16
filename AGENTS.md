# SnackFlow Agent Guide

## Project Purpose

SnackFlow manages snack distribution stock, sales, shop ledgers, payments, expenses, GPS shop locations, and date-wise reports for two warehouses and route-based order bookers.

## Tech Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLModel/SQLAlchemy
- Database: PostgreSQL
- Migrations: Alembic
- Auth: JWT

## Folder Structure

- `backend/app/models.py`: database models and enums
- `backend/app/carton.py`: carton/packet conversion helpers (split, label, to_packets)
- `backend/app/schemas.py`: API request/response schemas
- `frontend/lib/cartons.ts`: carton/packet conversion helpers for the UI
- `frontend/lib/csv.ts`: carton-friendly CSV export with explicit columns + Excel BOM
- `backend/app/routers/`: REST endpoints
- `backend/app/services/`: business logic for stock, sales, ledgers, payments
- `backend/alembic/versions/`: migrations
- `backend/tests/`: backend tests
- `frontend/app/`: Next.js routes
- `frontend/components/`: shared UI components
- `docs/`: requirements, audit, and user manual docs

## Commands

Backend setup:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

Backend tests:

```bash
cd backend
source .venv/bin/activate
pytest
```

Frontend:

```bash
cd frontend
npm install
npm run typecheck
npm run build
npm run dev
```

Manual PDF:

```bash
python3 scripts/generate_manual_pdf.py
```

## Non-Negotiable Business Rules

- Do not delete stock or financial history.
- Use reversals and return entries instead of destructive edits.
- Stock is warehouse-specific.
- Stock is stored internally in packets.
- `inventory_balances` is current state.
- `stock_ledger` is historical truth.
- Confirmed/delivered sales reduce stock.
- Booked/draft sales do not reduce stock.
- Reversed sales add stock back.
- Payments reduce shop pending balance.
- Order bookers are scoped to assigned warehouse and assigned shops/routes.
- Warehouse 1 and Warehouse 2 stock must never mix.

## Carton-First Rule

- The business sells in cartons; stock is stored in packets.
- Convert with the SKU `pack_quantity`: `cartons = floor(packets / pack_quantity)`, `loose = packets % pack_quantity`.
- Carton cost/sale rate = per-packet value × `pack_quantity`. When saving, convert carton rates back to per-packet before storing.
- Every screen and CSV that shows quantities or prices must be carton-first; keep packets as secondary detail.

## Shop Approval

- `Shop.status` is `ACTIVE` / `PENDING_APPROVAL` / `REJECTED` (default `ACTIVE`).
- Order-booker-created shops are forced to the booker's warehouse + self and set `PENDING_APPROVAL`.
- Admin/accountant approve or reject via `POST /shops/{id}/approval`.
