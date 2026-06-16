# Client Feedback — Zaib Brothers (received 2026-06-15)

This document records the client's handwritten + WhatsApp feedback after UAT and
the action taken in the focused fix pass on 2026-06-16. SnackFlow remains the
system/product name; **Zaib Brothers** is the legal/business name. Headers and
the order-booker app now read *“SnackFlow — Distribution Management System for
Zaib Brothers.”*

The core business thinks and sells in **cartons**. The backend still stores stock
internally in **packets** for accuracy; the UI is now carton-first wherever a
user enters, views, sells, receives, exports, or reports stock:

```
cartons       = floor(quantity_packets / pack_quantity)
loose_packets = quantity_packets % pack_quantity     →  "12 cartons + 5 pkts"
cost_per_carton      = cost_per_packet      × pack_quantity
sale_rate_per_carton = sale_rate_per_packet × pack_quantity
```

## Handwritten feedback (transcription) and status

| # | Feedback (as written) | Action taken | Status |
|---|---|---|---|
| 1 | Inventory price to be shown in carton — we sell in cartons | Inventory screen shows stock as cartons + loose packets and **Cost / Carton** (with per-packet secondary). | ✅ Fixed |
| 2 | Cartons / pack price to be confirmed — sale shown in cartons | SKU screen shows pack quantity, cost/carton, sale rate/carton, min/carton. Sales + mobile entry are carton-first. | ✅ Fixed |
| 3 | Sale date to be mentioned | Sale date/time shown in the sales list, sale detail, and recorded automatically. | ✅ Fixed |
| 4 | Stock update to be mentioned | Stock receive returns a success message with the new carton balance. | ✅ Fixed |
| 5 | Stock received with date and reflect cartons | Stock Receive has a Received date field; receipts and ledger show cartons. | ✅ Fixed |
| 6 | Inventory: when change made, average cost does not change? | Weighted-average cost confirmed correct and covered by tests (first receipt, second receipt at different cost, sale does not change it). Documented behaviour. | ✅ Fixed / Documented |
| 7 | CSV amended format does not support | CSV exports rebuilt with explicit carton columns + UTF-8 BOM so Excel opens correctly (Inventory, Sales, Stock Ledger, Payments, Expenses, Item-sales). | ✅ Fixed |
| 8 | SKUs price & history: scroll bar issue, form disappears | SKU/Resource edit form + history panel is now sticky and independently scrollable; tables scroll horizontally on small screens. | ✅ Fixed |
| 9 | Price to show carton cost and sale — missing | Carton cost and carton sale rate added to SKU, inventory, sales, mobile, ledger. | ✅ Fixed |
| 10 | Distribution Control tab: stock & ledger not working | The decorative Stock/Ledger chips are now real links; added a working **Distribution Control** dashboard page. | ✅ Fixed |
| 11 | Order booker: price of products in cartons (was packets) | Mobile order entry shows price per carton, available stock in cartons, last/fixed/default rate per carton. | ✅ Fixed |
| 12 | Shops: credit/balance shown to order booker; collected amount auto-updates with date/time | Mobile **Collect** tab shows previous balance, today's bill, total payable, collected today, remaining balance, last payment date. Payment records date/time automatically and updates balance. | ✅ Fixed |
| 13 | Order booker: provision of adding new shops | Mobile **Add new shop** form. Booker shops are scoped to the booker's warehouse + self and created as `PENDING_APPROVAL`; admin approves. | ✅ Fixed |
| 14 | Expenses tab was missing | Expenses tab present in sidebar + mobile nav, with create form, list, date/category, report, and CSV. | ✅ Fixed |
| 15 | Reversal entry missing | Sales screen has a Sale detail panel with **Reverse whole sale** (reason required + warning) and **Partial return** (enter return cartons/packets). | ✅ Fixed |

## WhatsApp feedback and status

> “AoA, Shah G, this is my initial feedback. Additionally some of the tabs were
> only visible but were not working… Kia jb ye final jay he tu app bany ge tu
> link k through chaly he. Secondly, kia es ki koe usage space k liay fee etc
> bhi hoti ya nh.”

| Point | Action / Answer | Status |
|---|---|---|
| Some tabs visible but not working | Audited every sidebar/mobile item. The non-working items were the Distribution Control “Stock/Ledger” chips (now links) and the missing Distribution page (now built). All routes load and are role-aware. | ✅ Fixed |
| Will the final system be an app or run through a link? | SnackFlow runs as a **web app through a secure link**, works in a mobile browser, and can be installed as a **PWA/home-screen app**. A separate Android/Play Store app is optional future work. (See README + manual “App vs Link”.) | ✅ Answered |
| Any usage / storage / hosting fee? | Online use needs hosting/database/storage/domain, whose cost depends on the deployment choice. Local-only use can avoid hosting cost but limits remote access. (See README + manual “Costs”.) | ✅ Answered |

## Partially fixed / future work

- **Expenses CSV warehouse name** — Expenses CSV exports the warehouse id (not
  name) because the generic resource exporter does not join warehouses.
- **Native Android app** — not built; the PWA covers mobile use today.
- **Bulk shop GPS backfill** — order bookers capture GPS per shop; no bulk tool.

## Tests added

`backend/tests/test_client_feedback.py` covers: carton/packet split helpers,
carton+loose sales conversion, carton+loose receiving, SKU carton-cost exposure,
weighted-average cost (first receipt / second receipt at different cost / sale
does not change it), order-booker shop scoping + pending approval, admin
approval, collection summary, and that the Distribution Control + Expenses API
endpoints load with carton fields. All existing tests remain green.
