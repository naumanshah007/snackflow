# SnackFlow UAT Checklist

UAT date: 2026-06-14  
Environment: local FastAPI API on `127.0.0.1:8000`, Next frontend on `127.0.0.1:3000`  
Final UAT data stamp: `1781417713`

| Test Scenario | Expected Result | Actual Result | Status |
|---|---|---|---|
| Admin login | Admin logs in and `/auth/me` returns `OWNER`. | `admin / OWNER`. | PASS |
| Create or verify two warehouses | `Warehouse 1` and `Warehouse 2` exist as separate records. | `Warehouse 1 = 1`, `Warehouse 2 = 2`. | PASS |
| Verify booker assignments | `booker1` is assigned to Warehouse 1; `booker2` is assigned to Warehouse 2. | `booker1 = 1`, `booker2 = 2`. | PASS |
| Receive stock into Warehouse 1 | 3 cartons x 24 packets creates at least 72 packets in Warehouse 1. | Warehouse 1 UAT SKU stock: 72 packets. | PASS |
| Receive stock into Warehouse 2 | 2 cartons x 24 packets creates at least 48 packets in Warehouse 2. | Warehouse 2 UAT SKU stock: 48 packets. | PASS |
| Confirm warehouse stock remains separate | Warehouse balances for the same SKU remain independent. | Warehouse 1: 72 packets; Warehouse 2: 48 packets. | PASS |
| Booker 1 scoped view | Booker 1 only sees Warehouse 1 shops and stock. | Shops visible: 3; inventory warehouses visible: `[1]`. | PASS |
| Booker 2 scoped view | Booker 2 only sees Warehouse 2 shops and stock. | Shops visible: 3; inventory warehouses visible: `[2]`. | PASS |
| Create shop with GPS and Google Maps link | Shop saves GPS coordinates and frontend-compatible map URL exists. | `https://www.google.com/maps?q=31.5204,74.3587`. | PASS |
| Create delivered sale | Sale confirms as `DELIVERED`. | Sale `4` status: `DELIVERED`. | PASS |
| Confirm stock reduces | Delivered sale of 10 packets reduces Warehouse 1 stock by 10. | Before: 72; after: 62. | PASS |
| Confirm shop pending balance updates | Pending increases by net bill minus received payment: `180 - 40 = 140`. | Shop balance: `140.0`. | PASS |
| Record payment | Payment of 50 reduces pending balance from 140 to 90. | Payment `3`; balance: `90.0`. | PASS |
| Reverse delivered sale | Reversal returns stock, writes `SALE_REVERSAL` ledger, and keeps later payment as credit. | Status `REVERSED`; stock returned to 72; balance `-50.0`; reversal ledger present. | PASS |
| Partial return | 12 sold and 5 returned gives net stock change `-7`, balance `+126`, profit `+56`. | Status `PARTIALLY_RETURNED`; stock delta `-7`; balance `76.0`; profit delta `56.0`. | PASS |
| Enter expense | PETROL expense is saved and profit report expenses increase by 33. | Expense `3`; expense delta `33.0`. | PASS |
| Daily sales report | Recognized sale appears; reversed sale is excluded. | Partial sale present; reversed sale excluded. | PASS |
| Item sold report | Returned quantities are subtracted from item sales. | UAT SKU: 7 packets, amount `126.0`, profit `56.0`. | PASS |
| Payment recovery report | Explicit payment appears with correct amount. | Payment row found with amount `50.0`. | PASS |
| Profit report | Partially returned sale contributes adjusted gross profit; expenses affect net profit only. | Gross profit includes adjusted `56.0`; expense delta `33.0`. | PASS |
| Shop balance report | Shop balance reflects sale, payment, reversal, and partial return. | UAT shop balance: `76.0`. | PASS |
| Shop visit report | Booker visit is reported with status and GPS. | Visit found with status `NO_ORDER`. | PASS |
| Inventory report | Inventory report includes current Warehouse 1 UAT SKU balance. | UAT SKU Warehouse 1 stock: 65 packets. | PASS |
| Shop sales report | Reversed sale is excluded and partial return totals are adjusted. | UAT shop sales: `126.0`, sale count `1`, profit `56.0`. | PASS |
| Manual PDF opens | `/docs/SnackFlow_User_Handover_Manual.pdf` returns a PDF. | HTTP `200`, `application/pdf`, 1,487,905 bytes. | PASS |

## Fixes From UAT

- Initial UAT found that profit reports excluded `PARTIALLY_RETURNED` sales.
- Initial UAT found that daily sales, item sold, and shop sales reports counted reversed sales and original item quantities before returns.
- Fixed report logic in `backend/app/routers/reports.py` to use recognized revenue statuses only: `DELIVERED`, `CONFIRMED`, and `PARTIALLY_RETURNED`.
- Fixed item-level report math to subtract `SaleReturnItem` quantities before calculating packets, amount, and profit.
- Added backend regression coverage for reversed-sale exclusion and net partial-return reporting.

## Final Verification Commands

| Check | Expected Result | Actual Result | Status |
|---|---|---|---|
| Backend tests | `pytest -q` passes. | `13 passed in 0.98s`. | PASS |
| Backend compile check | `python -m compileall app` succeeds. | Compile check completed for `app`, `app/routers`, `app/services`, and `app/tests`. | PASS |
| Frontend typecheck | `npm run typecheck` succeeds. | `tsc --noEmit` completed with exit code 0. | PASS |
| Frontend build | `npm run build` succeeds. | Next.js production build compiled successfully and generated 21 static pages. | PASS |
