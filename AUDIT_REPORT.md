# SnackFlow Audit Report

Audit date: 2026-06-14

## Executive Summary

SnackFlow already had a strong MVP foundation: JWT login, role-aware users, warehouse-specific inventory, packet-level stock, sales confirmation, shop ledgers, payments, expenses, rate rules, reports, GPS shops, and a mobile route workflow. The audit found four Priority 0/1 gaps: partial returns were not implemented, sale reversals did not store who/when metadata, sale confirmation needed stronger route/warehouse validation, and report/seed/test coverage was too thin for a money-and-stock system.

This pass implemented the critical business fixes: partial return tables/service/API, reversal metadata, stronger stock/sale validation, additional reports, richer seed data, and expanded backend tests.

## A. Requirement Coverage Matrix

| Requirement | Current Status | Evidence in Code | Gap / Risk | Action Needed |
|---|---|---|---|---|
| Auth and roles | Complete | `app/routers/auth.py`, `UserRole` | Password policy is basic | Future hardening |
| User management | Complete | `/users` routes | Owner-only edits are enforced | Monitor permissions |
| Warehouse management | Complete | `Warehouse`, `/warehouses` | None critical | None |
| Two separate warehouses | Complete | seed creates Warehouse 1/2 | None | None |
| Two order bookers | Complete | seed creates `booker1`, `booker2` | None | None |
| Order booker assignment to warehouse | Complete | `assigned_warehouse_id` | None | None |
| Shop assignment to order booker/warehouse | Complete | `Shop.assigned_*` | Now enforced in sale creation/confirmation | Done |
| Product management | Complete | `/products` | Category UI is basic | Future polish |
| SKU management | Complete | `/skus` | None critical | None |
| Product size/MRP | Complete | `SKU.size_mrp` | None | None |
| Flavours | Complete | `SKU.flavour` | None | None |
| Pack quantity 12 to 26 packets | Complete | seed cycle `[12,18,20,24,26]` | Manual entries can exceed range | Future validation option |
| Stock received date-wise | Complete | `StockReceipt.date_received` | None | None |
| Stock received at cost | Complete | `cost_per_packet`, avg cost | None | None |
| Stock stored internally in packets | Complete | `quantity_packets` fields | None | None |
| Carton/bundle conversion to packets | Complete | `receive_stock()` | Covered by tests | Done |
| Inventory balances | Complete | `InventoryBalance` | None | None |
| Warehouse-wise inventory | Complete | unique warehouse/SKU balance | None | None |
| Stock ledger | Complete | `StockLedger` | None | None |
| Sales by shopkeeper | Complete | `Sale.shop_id`, reports | Shop name added in API rows | None |
| Sales by date | Complete | date filters in `/sales`, reports | None | None |
| Sales through order booker | Complete | `order_booker_id` | None | None |
| Order booker can see available inventory | Complete | `/inventory` scope | None | None |
| Shopkeeper pending bills | Complete | `Shop.current_balance`, ledger | None | None |
| Today's bill | Complete | sale net/pending amounts | UI shows sale totals | None |
| Sale confirmation | Complete | `confirm_sale()` | Strengthened validation | Done |
| Sold items subtract from inventory | Complete | `SALE_OUT` movement | Covered by tests | Done |
| Cancelled order handling | Complete | `cancel_sale()` | Delivered cannot cancel | Done |
| Shop closed/no order handling | Complete | `ShopVisit` statuses | Mobile supports visit logging | None |
| Reversal entry workflow | Complete | `reverse_sale()` | Added reversed_by/reversed_at | Done |
| Partial return workflow | Complete | `return_sale_items()` | New implementation | Done |
| Payments | Complete | `Payment`, shop ledger | Covered by tests | Done |
| Daily sales profit | Complete | dashboard/profit report | None | None |
| Flexible editable sale rates | Complete | SKU/rate rule CRUD | None | None |
| Last sale rate visible to order booker | Complete | `LastSaleRate`, rate context | Covered by tests | Done |
| Fixed shop-specific rate | Complete | `ShopRateRule` | API returns fixed rate | Done |
| Expenses | Complete | `Expense` routes | None | None |
| Petrol expense | Complete | `ExpenseCategory.PETROL` | Seed sample added | Done |
| Vehicle maintenance expense | Complete | enum | None | None |
| Salaries | Complete | enum | None | None |
| Rent | Complete | enum | None | None |
| Utility bills | Complete | enum | None | None |
| Labour charges | Complete | enum | None | None |
| Date-wise item sold report | Complete | `/reports/item-sales` | Covered by tests | Done |
| Warehouse-wise reports | Complete | inventory/profit filters | None | None |
| Order-booker-wise reports | Complete | `/reports/order-booker` | Visits count can be improved | Future |
| Shopkeeper ledger report | Complete | `/shops/{id}/ledger` | UI could expose deeper detail | Future |
| Payment recovery report | Complete | `/reports/payment-recovery` | New endpoint | Done |
| Daily profit report | Complete | `/reports/profit` | Covered by tests | Done |
| GPS-tagged shops | Complete | lat/lng fields and UI | Covered by model test | Done |
| Open shop in Google Maps | Complete | frontend links | None | None |
| Mobile order-booker interface | Partial | `/mobile` | Dashboard stats can improve further | Priority 2 |
| Admin dashboard | Complete | `/dashboard`, `/reports/dashboard` | Added outstanding/stock value | Done |
| CSV export | Partial | frontend CSV helper on major reports | Payment/visit CSV UI can expand | Priority 3 |
| Print/PDF export if available | Complete | print reports, manual PDF | App report PDF not implemented | Future |
| Audit logs | Complete | `AuditLog` writes | Broaden action metadata over time | Future |
| Seed data | Complete | `app/seed.py` | Added sample sale/payment/expense | Done |
| Tests | Complete | 12 backend tests | Frontend tests not configured | Future |
| README | Complete | `README.md` | Updated | Done |
| Deployment/local setup | Complete | Docker Compose/env examples | Docker daemon must be running | None |

## B. Critical Business Logic Review

1. Stock is stored internally in packets through `quantity_packets`.
2. Stock receipt converts carton/bundle to packets in `receive_stock()`.
3. Inventory is separated by `warehouse_id` and `sku_id`.
4. Order bookers cannot sell from another warehouse.
5. Order bookers are scoped to assigned shops/routes for sale creation and confirmation.
6. Stock reduces only after delivered/confirmed sale.
7. Cancelled booked sales do not create stock movement.
8. Shop closed/no order creates a visit log only.
9. Reversed sale adds stock back.
10. Reversal adjusts shop ledger.
11. Original sale remains visible; status changes to `REVERSED`.
12. Stock cannot go negative by default.
13. Negative stock is blocked unless a service call explicitly opts in.
14. Cost of goods sold is stored on `SaleItem.cost_rate`.
15. Profit uses stored sale-item cost.
16. Credit and cash are separate: `payment_received` vs `pending_amount`.
17. Shop pending balance is maintained by `ShopLedger`.
18. Payments reduce pending balance.
19. Last sale rates are saved on confirmation.
20. Fixed shop rates are returned through rate context.
21. Expenses are separate from COGS.
22. Admin can view combined and warehouse-wise reports.
23. GPS is captured and saved in shop fields.
24. Google Maps links use latitude/longitude.

## C. Technical Quality Review

- Project structure: clear backend/frontend split with routers/services/models.
- API design: RESTful and practical; partial returns now implemented.
- Database normalization: adequate for MVP; current state and historical ledgers are separated.
- Indexes: important foreign keys and date fields are indexed; more composite report indexes can be added later.
- Migrations: Alembic initial schema plus return/reversal migration added.
- Frontend routes: broad coverage for admin and mobile workflows.
- Reusable components: shell, table, stat cards, resource forms.
- Validation/error handling: strengthened sale confirmation and return validation.
- Auth security: JWT/password hashing implemented; production needs stronger secret/password policy.
- Role permissions: core warehouse/order-booker scope enforced.
- Transaction handling: service functions commit atomically per operation; row locking is future work.
- Concurrency risks: simultaneous confirmations could race inventory; future Postgres row-level locking recommended.
- Test coverage: expanded for critical business rules.
- Seed quality: now includes sample stock, sale, payment, and expense.
- Docker/local setup: present and documented.
- Environment variables: documented in `.env.example`.
- README accuracy: updated.
- Mobile responsiveness: good MVP; dashboard metrics can improve further.
- Report performance: fine for MVP; aggregate SQL should replace Python loops at larger scale.

## D. Improvement Plan

### Priority 0: Data correctness / money / inventory bugs

- Implement partial returns with quantity validation, stock return, shop-ledger adjustment, and profit adjustment. Done.
- Add reversal `reversed_by_id` and `reversed_at`. Done.
- Strengthen sale confirmation for items, SKU existence, shop assignment, warehouse match, stock availability. Done.

### Priority 1: Missing business requirements

- Add payment recovery and shop visit report endpoints. Done.
- Add sample sale/payment/expense to seed data. Done.
- Expand backend tests for stock, sales, returns, rates, reports, GPS. Done.
- Add original requirements and voice transcript to docs. Done.

### Priority 2: UX improvements

- Improve mobile dashboard cards and available-stock display in order lines.
- Add dedicated return UI for admins.

### Priority 3: Reports/export/polish

- Add CSV buttons for every new report endpoint.
- Add report-level PDF export.

### Priority 4: Future enhancements

- Add stock transfers between warehouses.
- Add row-level locking around inventory updates.
- Add database backups and restore documentation.
- Add frontend automated tests.
