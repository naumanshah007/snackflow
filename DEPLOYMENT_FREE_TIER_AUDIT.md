# SnackFlow Free-Tier Deployment Audit

Audit date: 2026-06-20

Live frontend: https://snackflow-frontend.vercel.app

Live backend observed from frontend bundle: https://snackflow-backend.vercel.app

No secret values are included in this report.

## 1. Current Live Frontend Status

- The frontend is configured for Vercel. `frontend/.vercel/project.json` exists locally and Vercel CLI reports the production deployment is ready.
- The live login page loads successfully at `/login` with HTTP 200.
- The live app home page loads successfully with HTTP 200.
- The deployed frontend JavaScript currently has `NEXT_PUBLIC_API_URL` baked as `https://snackflow-backend.vercel.app`.
- Therefore, the live frontend is not calling `localhost`; it is calling the live backend.
- Safe authenticated read checks against the live backend returned HTTP 200 for `/auth/me`, `/reports/dashboard`, `/inventory`, and `/sales`.
- The manual PDF is accessible from the live site at `/docs/SnackFlow_User_Handover_Manual.pdf` with HTTP 200 and `application/pdf`.
- Static assets are being served from `frontend/public/`, including `/logo.png`, `/manifest.json`, and the manual PDF.
- Local frontend config uses `frontend/lib/api.ts`, where `NEXT_PUBLIC_API_URL` falls back to `http://localhost:8000` only when the env var is missing at build time.
- Hardcoded local URLs found are local-development defaults in README, Docker Compose, env examples, and the API fallback. The live build is not using the fallback.

Frontend Vercel env status from CLI:

- `NEXT_PUBLIC_API_URL`: present in Production, encrypted.

## 2. Current Backend Status

- The backend is a FastAPI app with entrypoint `backend/index.py` importing `app.main:app`.
- Vercel CLI reports the backend deployment is ready at `https://snackflow-backend.vercel.app`.
- `/health` returns HTTP 200 with `{"status":"ok"}`.
- `/docs` returns HTTP 200.
- CORS preflight from `https://snackflow-frontend.vercel.app` to `/auth/login` returns HTTP 200.
- Observed CORS response is `access-control-allow-origin: *`. This works because the API uses bearer tokens and `allow_credentials=False`, but production should preferably restrict this to the frontend domain.
- Login with the documented seeded admin credentials returned HTTP 200. This proves the frontend/backend path works, but it is a security blocker unless the live admin password has been changed immediately after setup.

Backend Vercel env status from CLI:

- `DATABASE_URL`: present in Production, encrypted.
- `JWT_SECRET`: present in Production, encrypted.
- `BACKEND_CORS_ORIGINS`: present in Production, encrypted.
- `AUTO_CREATE_TABLES`: present in Production, encrypted.
- `AUTO_SEED_DEMO`: present in Production, encrypted.
- Neon/Postgres-related env names are present, including `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`, `POSTGRES_DATABASE`, `POSTGRES_HOST`, and `NEON_PROJECT_ID`.

Backend deployment readiness:

- `backend/requirements.txt` includes FastAPI, Uvicorn, SQLModel, Alembic, psycopg2, JWT, password hashing, multipart, pytest, and reportlab.
- `backend/Dockerfile` can run FastAPI with Uvicorn on port 8000.
- `docker-compose.yml` runs Postgres, backend migrations, seed data, and the frontend for local development.
- Alembic reads `settings.database_url`, so production migrations can target Postgres through `DATABASE_URL`.
- The backend defaults to SQLite (`sqlite:///./snackflow.db`) if `DATABASE_URL` is missing.
- SQLite is acceptable for local testing only. It is not safe for free cloud/serverless hosting unless persistent writable disk is guaranteed.

## 3. Current Database Status

The live backend has an encrypted production `DATABASE_URL` plus Neon/Postgres variables in Vercel. That strongly indicates the live database is Neon Postgres, not SQLite.

Current code compatibility:

| Option | Compatible | Can run free? | Storage limit concern | Backup concern | Migration support | Data persistence risk | Suitable for Zaib Brothers MVP? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SQLite local file | Yes locally | Yes locally | Limited by local disk | Manual file copy only | Alembic can run | High on cloud/serverless because local files can be lost | Local demo only |
| Neon free Postgres | Yes | Yes | Free plan is small; official docs list 0.5 GB per project plus compute/egress limits | Free backups/restore are limited; still do monthly exports | Good with Alembic | Low if `DATABASE_URL` is used, but quota can pause/block usage | Best free MVP choice |
| Supabase free Postgres | Yes | Yes | Official docs list 500 MB database quota; project can become read-only when exceeded | Automated daily backups are a paid-plan feature; do manual exports | Good with Alembic | Low if below quota, medium when nearing quota/read-only mode | Good free MVP choice |
| Render Postgres | Yes | Temporarily | Free Render Postgres expires after 30 days | Not suitable for permanent backup/retention on free DB | Good with Alembic | High for permanent Rs 0 because DB expires | No for permanent MVP |
| Railway Postgres | Yes | Usually no permanent Rs 0 | Hobby has storage limits and usage billing/minimums | Depends on paid plan/configuration | Good with Alembic | Low technically, but not truly Rs 0 | Good paid/near-paid option |
| Other standard Postgres | Yes | Depends on provider | Varies | Varies | Good with Alembic | Usually low on managed Postgres | Suitable if it provides a normal Postgres URL |

Official provider notes checked:

- Vercel Hobby is free but intended for personal/small-scale use and has usage limits: https://vercel.com/docs/plans/hobby
- Render free web services sleep after 15 minutes, lose local filesystem changes, and free Render Postgres expires after 30 days: https://render.com/docs/free
- Neon free plan has Postgres with limited storage/compute and scale-to-zero behavior: https://neon.com/pricing and https://neon.com/docs/introduction/plans
- Supabase free plan includes a 500 MB database quota and can enter read-only mode if exceeded: https://supabase.com/docs/guides/platform/billing-on-supabase and https://supabase.com/docs/guides/platform/database-size
- Fly.io states there is no general free tier, only trials/allowances: https://fly.io/docs/about/cost-management/
- Railway Hobby pricing includes a monthly minimum usage credit model: https://railway.com/pricing

## 4. Can This Run Free?

Technically, yes, the current app can run at Rs 0/month for an MVP if:

- Frontend stays on Vercel.
- Backend stays on Vercel serverless or another free backend platform.
- Database stays on Neon free Postgres or Supabase free Postgres.
- Usage remains low.
- The owner accepts cold starts, free-tier quotas, limited support, and manual backups.

Practically, there are caveats:

- Vercel Hobby has terms and fair-use limits. For a real client/business, check whether Hobby is acceptable for the usage. A commercial production system may need a paid plan even if the traffic is small.
- A free backend can have cold starts. First login after inactivity may be slow.
- A free database can sleep/scale to zero or hit storage/compute limits.
- Free tiers are not a backup strategy.
- Free provider limits can change.
- Non-technical business owners usually need a maintenance person to monitor usage, backups, passwords, and deployments.

## 5. Recommended Free Setup

Recommended Rs 0/month MVP architecture:

- Frontend: Vercel project `snackflow-frontend`.
- Backend: Vercel project `snackflow-backend` using `backend/index.py`.
- Database: Neon free Postgres.
- Frontend env: `NEXT_PUBLIC_API_URL=https://snackflow-backend.vercel.app`.
- Backend env: `DATABASE_URL`, `JWT_SECRET`, `BACKEND_CORS_ORIGINS`, `AUTO_CREATE_TABLES`, `AUTO_SEED_DEMO`, `SNACKFLOW_DEMO_SEED`, `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD`, `MONTHLY_ARCHIVE_ENABLED`.
- CORS: set `BACKEND_CORS_ORIGINS=https://snackflow-frontend.vercel.app` for production instead of `*`.
- Migrations: run `alembic upgrade head` against the production `DATABASE_URL` during deployment or as a controlled manual step.
- Seeding: keep `SNACKFLOW_DEMO_SEED=false` in production. If production has no users, create the first admin only through `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD`.

## 6. Required Environment Variables

Frontend:

- `NEXT_PUBLIC_API_URL`: required for live deployment. Present in Vercel Production.

Backend:

- `DATABASE_URL`: required for durable live data. Present in Vercel Production.
- `JWT_SECRET`: required and must be strong/random. Present in Vercel Production.
- `JWT_EXPIRY_MINUTES`: optional; defaults to 720.
- `BACKEND_CORS_ORIGINS`: required for production browser access. Present in Vercel Production.
- `AUTO_CREATE_TABLES`: optional; present in Vercel Production.
- `AUTO_SEED_DEMO`: optional but dangerous if true in production; present in Vercel Production.
- `SNACKFLOW_DEMO_SEED`: must be false/missing in production. Enables local demo password resets only when explicitly true.
- `INITIAL_ADMIN_USERNAME`: optional secure first-admin username for an empty production database.
- `INITIAL_ADMIN_PASSWORD`: optional secure first-admin password for an empty production database.
- `MONTHLY_ARCHIVE_ENABLED`: should remain false until a separate archive/delete policy is approved.

Do not expose backend `DATABASE_URL`, Postgres variables, JWT secret, or Vercel project IDs to frontend code.

## 7. Current Gaps / Blockers

Critical:

- Live login accepted the documented default seeded admin credentials. Change the live admin password immediately and ensure production seeding does not reset it.

High:

- Observed live CORS is `*`. It works technically, but production should restrict `BACKEND_CORS_ORIGINS` to `https://snackflow-frontend.vercel.app`.
- Confirm that `AUTO_SEED_DEMO=false` and `SNACKFLOW_DEMO_SEED=false` in production. Demo password reset is now guarded by explicit demo/development settings.
- Confirm migrations are run intentionally against production before model changes. `AUTO_CREATE_TABLES` can create tables but is not a substitute for controlled Alembic migrations.

Medium:

- Free-tier database storage is small. Reports and audit logs will grow over time.
- Monthly Closing Phase 1 now provides preview, streamed ZIP backup, closing summary, backup checksum metadata, and carry-forward opening balances.
- Detailed row archive/delete is intentionally disabled by default. Keep it disabled until a separate production cleanup policy is approved.
- No custom domain is configured, but the owner said this is acceptable.

## 8. Data Retention and Monthly Cleanup Recommendation

Current support:

- Monthly closing: Phase 1 implemented at `/monthly-closing`.
- Export old sales reports: monthly backup ZIP includes `sales.csv` and `sale_items.csv`.
- Export shop ledgers: monthly backup ZIP includes `shop_ledger.csv`.
- Export stock ledgers: monthly backup ZIP includes `stock_ledger.csv`.
- Carry forward shop balances: close month creates next-month `monthly_shop_opening_balances` rows from current shop balances.
- Carry forward inventory balances: close month creates next-month `monthly_inventory_opening_balances` rows from current inventory balances.
- Delete/archive old transactions safely: destructive cleanup is not implemented; archive endpoint is guarded and disabled with `MONTHLY_ARCHIVE_ENABLED=false`.
- Manual backup exports: monthly backup ZIP includes business CSVs and master/current balance CSVs. The ZIP is streamed to the browser and must be saved immediately; Vercel/serverless local disk is not permanent backup storage.
- CSV exports for major reports: supported for sales, item sales, shop balances, low stock, inventory, stock ledger, payments, expenses, and several resource pages.

Implemented safe feature: Monthly Closing & Archive, Phase 1.

It now:

- Export the month as CSV files before any cleanup.
- Include sales, sale items, payments, expenses, shop ledgers, stock ledgers, stock receipts, inventory, shops, SKUs, and users.
- Calculate closing shop balances.
- Calculate closing warehouse inventory by warehouse and SKU.
- Create next-month opening shop balances.
- Create next-month opening inventory balances.
- Preserve summary rows and audit records.
- Allow admin download of a backup ZIP before cleanup.
- Store backup filename, checksum, and generated time in the database without depending on local disk.
- Blocks archive/delete by default.

Phase 2 should:

- Only archive/delete old detailed rows after export verification.
- Prefer archive tables or marked-as-archived rows over hard delete wherever possible.
- Require a second confirmation and a documented restore procedure before any hard delete is enabled.

Do not blindly delete old sales, ledgers, payments, or stock history. Those rows are the accounting and inventory audit trail.

## 9. Backup Recommendation

For Rs 0/month:

- Use SnackFlow Monthly Closing monthly and download/save the generated ZIP to laptop/Google Drive before any cleanup.
- Download Neon/Supabase SQL backup manually at least monthly if available.
- Download SnackFlow CSV reports monthly.
- Store backups in two places, for example owner laptop plus Google Drive.
- Export before every migration or deployment that changes database structure.
- Keep at least 3 monthly backups.

Better low-cost backup:

- Use a paid Postgres plan with automated daily backups.
- Keep app-level CSV/ZIP exports for business-friendly recovery and accountant review.

## 10. Risks of Free Hosting

- Cold starts: first login can be slow after inactivity.
- Provider limits: free quotas can pause services or block writes.
- Storage limits: free Postgres can fill quickly with audit logs and detailed transactions.
- No strong SLA: free tiers are not designed for business-critical uptime.
- Data loss risk if SQLite/local files are used on ephemeral cloud filesystems.
- Manual operations: backups, migrations, and password rotation need discipline.
- Terms risk: commercial business usage may require a paid plan depending on provider terms.

## 11. When to Upgrade to Paid Hosting

Upgrade when any of these happen:

- The shop depends on SnackFlow daily and downtime affects deliveries/cash collection.
- More than a few users use it every day.
- The first-login delay becomes unacceptable.
- Database reaches 60-70% of free storage.
- Backups need to be automatic.
- The owner wants support, stability, and less manual maintenance.
- The system stores months of financial history that cannot be recreated.

Minimum serious paid setup:

- Frontend: Vercel Pro or keep Vercel if terms/usage allow.
- Backend: Render/Railway/Fly/DigitalOcean paid always-on service.
- Database: Neon Launch, Supabase Pro, Render paid Postgres, or another paid managed Postgres.
- Backups: automatic daily database backups plus monthly CSV/ZIP exports.

Best low-cost stable setup:

- Frontend: Vercel.
- Backend: Render Starter or equivalent small always-on service.
- Database: Supabase Pro or Neon paid plan.
- Monthly backup/export process documented for the owner.

## 12. Simple Explanation for Non-Technical Owner

SnackFlow can work through a simple web link. A custom domain is not required.

The current live frontend is already connected to a live backend, and that backend is connected to a Postgres database through encrypted deployment variables. So the basic online setup is already working.

The cheapest MVP can be Rs 0/month if free tiers remain within limits. The tradeoff is that free services may be slower after inactivity, have storage limits, and require manual backups. For real daily business use, a small paid setup is safer.

The most urgent action is to change the default admin password on the live system and keep monthly backups/exports.

## 13. Final Monthly Cost Estimate

- Initial free MVP: Rs 0/month.
- Safer paid option: about Rs 3,500-9,000/month depending on selected backend/database plans and exchange rate.
- Best low-cost stable setup: about Rs 7,000-15,000/month for always-on backend plus managed Postgres with better backups/reliability.
- Domain: optional, yearly.
- Custom Android app: optional future work.

## Client WhatsApp Message

SnackFlow link se chal sakta hai, custom domain zaroori nahi hai. Abhi frontend live hai aur backend/database se connect ho raha hai. Initial setup free tier par Rs 0/month mein chal sakta hai, lekin free hosting mein kabhi kabhi pehli login slow ho sakti hai aur database storage limited hoti hai. Is liye monthly backup/export lazmi rakhna hoga. Agar business daily is system par depend karne lage ya data zyada ho jaye, phir reliable paid hosting lena behtar hoga. Sab se pehle live admin ka default password change karna zaroori hai.
