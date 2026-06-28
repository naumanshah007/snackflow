# Client Feedback - 2026-06-28

Live feedback from Zaib Brothers covered owner lockout, unclear pending-shop approval, and order-booker visibility into admin/accounting areas.

## Fixed

- Added `backend/scripts/reset_owner_password.py` for maintainer-only owner password recovery using `DATABASE_URL`, `RESET_OWNER_USERNAME`, and `RESET_OWNER_PASSWORD`.
- Added `docs/ops/PASSWORD_RECOVERY.md` with the recovery process, required env vars, and password handling rules.
- Clarified owner user-password reset UX on the Users page. Blank password keeps the existing password; a non-blank password resets it.
- Added explicit Shops page filters: All Shops, Active, Pending Approval, Rejected / Inactive.
- Added visible `PENDING APPROVAL` badges and Approve / Reject actions for pending shops.
- Added pending-shop count click-through on the Shops page.
- Blocked sales and payment collection for pending shops until admin approval.
- Redirected order bookers away from admin pages to `/mobile`.
- Role-filtered the sidebar and mobile drawer.
- Blocked order bookers from reports, stock ledger, monthly closing, expenses, users, reset-data, supplier returns, and internal shop ledger APIs.
- Redacted cost/profit fields from order-booker `/inventory`, `/skus`, `/sales`, and mobile-safe responses.
- Scoped order-booker payment listing to assigned shops only.
- Improved Settings password change UX with current password, new password, confirm password, show/hide toggles, and validation.

## Security Rule

Order bookers may see selling, stock availability, route, payment collection, GPS, and shop pending-balance information only. They must never receive or see cost price, stock value at cost, COGS, gross profit, net profit, internal ledger, reports center, monthly closing, reset-data, users, or admin controls.

## Operations

Do not send passwords in public chat. If owner recovery is needed, the maintainer should set a temporary password privately, have the owner log in, and then require the owner to change it from Settings.

## Tests Added

- Order booker cannot access reports dashboard, stock ledger, monthly closing, expenses, users, reset-data, supplier returns, or shop ledger.
- Order booker inventory/SKU/sales/mobile summary responses hide internal cost and profit fields.
- Owner still sees cost and profit fields where required.
- Pending shop can be listed and approved by admin; order booker cannot approve.
- Pending shop cannot be used for sale before approval.
- Blank user password update preserves the existing password.
