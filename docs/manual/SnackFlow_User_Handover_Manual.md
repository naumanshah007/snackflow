# SnackFlow — Distribution Management System for Zaib Brothers

Stock, Sales, Shop Ledger & Distribution Management System

Version: 1.1  
Date: 16 June 2026  
Prepared for: Zaib Brothers — Business Owner / Admin

SnackFlow is the system name; Zaib Brothers is the business name.

## Table of Contents

1. Cover Page
2. What SnackFlow Does
3. User Roles
4. Login and Navigation
5. Admin Setup: First Time Use
6. Product and SKU Management
7. Warehouse and Inventory Management
8. Shop Management and GPS
9. Order Booker Mobile Workflow
10. Sales and Billing
11. Payments and Shopkeeper Pending Bills
12. Reversal and Return Procedure
13. Rate Management
14. Expenses
15. Profit Reports
16. Reports
17. Daily Business Routine
18. Common Problems and Solutions
19. Security and Best Practices
20. Glossary
21. Handover Checklist
22. Carton-First Working
23. App vs Link, and Costs
24. Monthly Closing & Archive
25. 2026-06-15 Feedback Update

## 1. Cover Page

SnackFlow is a stock, sales, shop ledger, and distribution management system for snack businesses.

Tagline: Smart Stock, Sales & Shop Ledger for Snack Distribution

The system is designed for business owners, warehouse staff, order bookers, and accountants who need accurate stock, sales, pending bills, recovery, expenses, profit, and GPS route records.

## 2. What SnackFlow Does

SnackFlow helps the business:

- Track stock in packets, cartons, and warehouse-wise balances.
- Handle Warehouse 1 and Warehouse 2 separately.
- Manage shop sales through order bookers.
- Track order booker field activity.
- Maintain shopkeeper pending bills.
- Record payments and recoveries.
- Track expenses such as petrol, vehicle maintenance, rent, salaries, bills, and labour.
- Calculate gross profit and net profit.
- Keep GPS locations for shops.
- Provide date-wise reports for sales, items, expenses, profit, and stock.

## 3. User Roles

### Admin / Owner

Can manage users, warehouses, products, SKUs, stock receiving, shops, order bookers, rates, all sales, reversals, returns, expenses, profit reports, exports, audit logs, and pending bills.

### Warehouse Manager

Can receive stock, view assigned warehouse stock, check stock ledger, view low stock, and make stock adjustments if allowed.

### Order Booker / Salesman

Can login on mobile, see assigned shops, see shop pending balance, create sale/order, see available stock, see last sale rate, see fixed shop rate, collect payment, mark shop closed/no order, and capture GPS location.

### Accountant / Viewer

Can view sales, expenses, shop ledgers, payments, profit reports, and exports where allowed.

## 4. Login and Navigation

Open the app in a browser:

- Admin web app: `http://localhost:3000`
- Mobile route workflow: `/mobile`

Login with your own username and password. The seeded admin login is `admin / admin123`; change this password before production use.

The sidebar contains Dashboard, Products, SKUs, Rates, Warehouses, Inventory, Stock Receive, Stock Ledger, Shops, Sales, Payments, Expenses, Reports, Users, Mobile, and Settings.

## 5. Admin Setup: First Time Use

1. Login as admin.
2. Change the default password.
3. Create or verify Warehouse 1 and Warehouse 2.
4. Create users.
5. Assign order bookers to warehouses.
6. Create products and SKUs.
7. Set pack quantities.
8. Set cost and default sale rates.
9. Create shops.
10. Assign shops to order bookers.
11. Capture GPS locations.
12. Enter opening stock.
13. Enter opening shop balances if any.

## 6. Product and SKU Management

Each product-size-flavour-pack combination is a separate SKU.

SKU fields include product name, size/MRP, flavour, pack quantity, unit type, cost price, default sale rate, minimum sale rate, SKU code, low stock threshold, and active/inactive status.

Example: Chips Rs 50 BBQ, 24 packets per carton.

Important: SnackFlow stores stock internally in packets. The UI can display cartons plus loose packets.

## 7. Warehouse and Inventory Management

Warehouse 1 and Warehouse 2 remain separate. Stock from one warehouse must not mix with the other.

Stock receiving workflow:

1. Go to Stock Receive.
2. Select warehouse.
3. Select SKU.
4. Enter quantity as carton, bundle, or packet.
5. Enter pack quantity and cost.
6. Save.
7. Check Inventory and Stock Ledger.

Stock ledger movement types include STOCK_IN, SALE_OUT, SALE_REVERSAL, RETURN_IN, DAMAGE_OUT, MANUAL_ADJUSTMENT_IN, and MANUAL_ADJUSTMENT_OUT.

## 8. Shop Management and GPS

Go to Shops to create or edit shop records.

Shop fields include shop name, owner name, phone, alternate phone, address, area/route, assigned warehouse, assigned order booker, credit limit, opening balance, GPS latitude, GPS longitude, notes, and active/inactive status.

Use Capture GPS to save the shop's current location. Use Open Map to check the shop in Google Maps.

GPS is important because if the order booker changes, the new order booker can still find the shop.

### Route Days (weekly route planning)

Each shop can be assigned **route days** (Monday to Sunday, multi-select) on the Shops form. This is the weekly schedule of which days the shop is visited.

- The shop card shows route-day chips; today's day is highlighted. Shops with none show "No route days".
- Use the **Route day** filter at the top of the Shops page to see only the shops for a chosen day (a quick "shops by route day" view).
- You can also set **working days** for each order booker on the Users page (Working / route days).
- When the order booker opens the mobile app, the **Today's Route** card lists exactly the shops scheduled for today, so they know where to go first.

To set route days: open a shop (or order booker), tap the day buttons (Mon, Tue, …) to toggle them on/off, then Save. Route days persist after refresh.

## 9. Order Booker Mobile Workflow

At the top of the Shops tab, **Today's Route** shows the shops assigned to today's weekday with their pending balances. Tap any shop in the card to select it, then take an order or collect payment as usual. If no shops are scheduled for today, you can still pick any shop from the list below.


1. Login from mobile.
2. Open `/mobile`.
3. View assigned shops.
4. Select shop.
5. Check pending balance.
6. Start new order.
7. Search product/SKU.
8. Check available stock where shown.
9. Check last sale rate/fixed rate.
10. Enter quantity.
11. Confirm rate.
12. Add more items.
13. Check total bill.
14. Enter payment received if any.
15. Book order.
16. Review the booking in Sales.

The mobile workflow also supports payment-only visits and shop closed/no order visit logging.

## 10. Sales and Billing

Sale statuses include draft/booked, delivered/confirmed, cancelled, reversed, and partially returned.

Stock reduces only after a delivered/confirmed sale. Booked or draft orders do not reduce stock.

Order bookers only take bookings from the mobile app. Low stock is shown as information, but booking is still allowed; the stock check happens later when admin/warehouse confirms delivery.

Shop pending formula:

Previous Pending + Today's Bill - Payment - Reversal/Return = New Pending

## 11. Payments and Shopkeeper Pending Bills

To enter payment:

1. Go to Payments.
2. Select shop.
3. Enter amount.
4. Select method.
5. Add notes/reference if needed.
6. Save.

Payment creates a shop ledger entry and reduces the shop's pending balance.

## 12. Reversal and Return Procedure

Use reversal when the full sale is wrong:

- Shop was closed after entry.
- Wrong order entered.
- Shopkeeper refused order.
- Duplicate order.
- Wrong quantity or item.

Rules:

- Do not delete confirmed sale.
- Reverse it with a reason.
- System adds stock back.
- System adjusts shop balance.
- Original sale remains in history.

Partial return:

1. Select sale.
2. Select returned sale items.
3. Enter returned quantity.
4. Add reason.
5. Save return.
6. Stock, balance, and profit update automatically.

## 13. Rate Management

SnackFlow supports:

- SKU default sale rate.
- Shop-specific fixed rate.
- Last sale rate for a shop and SKU.
- Minimum allowed rate.

Order bookers should see the default rate, fixed shop rate, and last sale rate before confirming the sale rate.

## 14. Expenses

Expense categories include petrol, vehicle maintenance, salaries, rent, utility bills, labour charges, loading/unloading, miscellaneous, and other.

Expense workflow:

1. Go to Expenses.
2. Select date.
3. Select category.
4. Enter amount.
5. Add notes.
6. Save.

## 15. Profit Reports

Gross Profit = Sales - Cost of Goods Sold

Net Profit = Gross Profit - Expenses

Cash received is not the same as profit. Credit sales increase shop pending balance. Expenses reduce net profit but not gross profit.

## 16. Reports

Reports include:

| Report | Purpose | Used By |
|---|---|---|
| Daily Sales Report | Check date-wise sales, cash, pending, profit | Owner, Accountant |
| Date-wise Item Sold Report | See which SKUs sold and quantities | Owner, Warehouse |
| Shop-wise Sales Report | Compare shops and pending | Owner, Accountant |
| Shopkeeper Pending Bills Report | Recover outstanding balances | Owner, Booker |
| Order Booker Sales Report | Review route performance | Owner |
| Warehouse-wise Inventory Report | See stock by warehouse | Owner, Warehouse |
| Stock Movement Ledger | Audit stock in/out/reversal/return | Owner, Warehouse |
| Daily Expense Report | Track business spending | Owner, Accountant |
| Profit Report | Compare sales, COGS, expenses, profit | Owner |
| Payment Recovery Report | Track collected payments | Owner, Accountant |
| Shop Visit / Closed Shop Report | Track field activity | Owner |
| Low Stock Report | Plan purchasing | Owner, Warehouse |
| Monthly Closing | Backup month data and carry balances forward | Owner, Accountant |

## 17. Daily Business Routine

Morning:

- Check available stock.
- Check low stock.
- Assign order booker route.
- Verify pending balances.

During day:

- Order booker enters sales.
- Order booker records closed shops/no order.
- Payments are recorded.

Evening:

- Admin checks daily sales.
- Admin checks cash received.
- Admin checks credit sales.
- Admin enters expenses.
- Admin reviews profit.
- Admin checks stock remaining.

## 18. Common Problems and Solutions

| Problem | Solution |
|---|---|
| Wrong item entered | Cancel if not confirmed; reverse if confirmed. |
| Shop closed | Mark shop closed/no order. |
| Stock not available | Receive stock or transfer from another warehouse if transfer feature is added. |
| Wrong sale rate | Edit before confirmation or reverse/re-enter if confirmed. |
| Order booker cannot see shop | Check shop assignment. |
| Order booker cannot see stock | Check warehouse assignment. |
| Pending balance seems wrong | Open shop ledger and review sale/payment/reversal entries. |

## 19. Security and Best Practices

- Every user should have their own login.
- Do not share admin password.
- Change default password.
- Reverse instead of deleting.
- Check daily reports.
- Keep rates updated.
- Backup database.
- Run monthly closing only after downloading and checking the backup.
- Review audit logs.

## 20. Glossary

- SKU: Product + size + flavour + pack combination.
- Pack quantity: Packets inside one carton/bundle.
- Carton: Larger packaging unit.
- Packet: Smallest stock unit.
- Stock ledger: Historical stock movement record.
- Shop ledger: Historical shop balance record.
- Pending balance: Amount shopkeeper still owes.
- Gross profit: Sales minus cost of goods sold.
- Net profit: Gross profit minus expenses.
- COGS: Cost of goods sold.
- Reversal: Full correction of delivered sale.
- Partial return: Return of selected sale items.
- Order booker: Field salesman who books orders.

## 21. Handover Checklist

- [ ] Admin login tested
- [ ] Warehouses created
- [ ] Users created
- [ ] Order bookers assigned
- [ ] Products/SKUs created
- [ ] Stock entered
- [ ] Shops created
- [ ] GPS captured
- [ ] Test sale completed
- [ ] Payment recorded
- [ ] Reversal tested
- [ ] Partial return tested
- [ ] Expense entered
- [ ] Reports checked
- [ ] Monthly closing backup tested
- [ ] Manual handed over

## 22. Carton-First Working

The business sells in cartons. SnackFlow now shows and accepts cartons everywhere, while still storing exact packet counts internally for accuracy.

- A SKU has a **pack quantity** = packets per carton (for example 24).
- Stock shows as **"12 cartons + 5 packets"**, with the total packets as secondary detail.
- Cost and sale price are shown **per carton** (carton price = packet price × pack quantity), with the per-packet value beside it.
- Stock receiving is entered in **cartons** (plus any loose packets) with a received date; after saving, the new carton balance is confirmed on screen.
- Sales and the order-booker app take **cartons + loose packets** and a **rate per carton**, and show available stock in cartons.
- CSV exports (Inventory, Sales, Stock Ledger, Payments, Expenses, Item-sales) include carton columns and open correctly in Excel.

## 23. App vs Link, and Costs

**How it runs.** SnackFlow runs as a web app through a secure link. Order bookers open it in a mobile browser. It can also be installed as a PWA / mobile-app-style shortcut on the phone's home screen. A separate Android / Play Store app can be built later if required — it is optional future work.

**Costs.** Online usage may need hosting, database, storage, and domain, whose cost depends on the deployment choice (for example a cloud server with managed database and a domain name). Local-only use can avoid hosting cost but limits remote access for field order bookers.

## 24. Monthly Closing & Archive

Monthly Closing helps keep the live database smaller for free-tier hosting while preserving month-end backup files and opening balances.

Admin workflow:

1. Open Monthly Closing.
2. Select the month to close.
3. Review preview totals: sales, payments, expenses, gross profit, net profit, outstanding shop balance, warehouse closing stock, and transaction counts.
4. Click Generate Backup and download the ZIP.
5. Check that the ZIP contains the expected CSV files.
6. Save the ZIP immediately to laptop/Google Drive.
7. Click Close Month only after backup is downloaded and saved.

The backup ZIP includes sales, sale items, payments, expenses, shop ledger, stock ledger, stock receipts/items, inventory balances, shops, SKUs, users summary without password hashes, and monthly summary.

The ZIP is generated on demand and streamed to the browser. Serverless hosting such as Vercel should not be treated as permanent file storage. SnackFlow stores the backup filename, checksum, generated time, and monthly summary in the database; later download is regenerated from database rows when available.

Closing creates next-month opening records for shop balances and warehouse/SKU inventory balances. It does not delete current balances.

Strong warning: **This action should only be done after downloading backup. It cannot be undone unless backup is restored.**

Phase 1 does not delete old detailed rows. Archive/delete is disabled by default and should only be enabled later after a separate archive policy is approved. Never blindly delete ledger history.

## 25. 2026-06-15 Feedback Update

This version applies the Zaib Brothers UAT feedback: carton-first inventory, stock, sales, mobile, SKU prices and reports; carton cost and carton sale price; stock receiving with date and new-balance confirmation; a working Distribution Control page; an Expenses tab; clear Reversal and Partial Return screens (open a sale and tap **View**); order bookers can add new shops (pending admin approval) and collect payments with the shop balance, today's bill, total payable, remaining balance, and last payment date shown. The full feedback log is in `CLIENT_FEEDBACK_2026_06_15.md`.
