# CompuCash Lite

Simple restaurant POS (cash register) web app: tables, orders, payments (cash / card / split), kitchen view, menu management and a daily Z-report. UI language is Estonian.

**Stack:** Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui-style components (Radix), Lucide icons, Prisma ORM, PostgreSQL.

## Deployment (Railway)

The app is deployed on Railway automatically from the `main` branch.

1. The Railway project has a **PostgreSQL** service and an app service connected to this repo.
2. In the app service's **Variables**, set `DATABASE_URL` to reference the database, e.g. `${{Postgres.DATABASE_URL}}`.
   Optional: `RESTAURANT_NAME` (shown on receipts).
3. Railway runs:
   - build: `npm run build` → `prisma generate && next build`
   - start: `npm start` → `prisma migrate deploy && node prisma/seed-if-empty.mjs && next start`

On every start, migrations are applied and, **only if the database is empty**, the seed creates tables *Laud 1–10* and imports the menu from `prisma/menu.csv` (falls back to `prisma/menu_1.csv`). `next start` listens on Railway's `PORT`.

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Tables (gray = free, amber = open order with total) |
| `/order/[id]` | Order screen: products by category, cart, send to kitchen, pay, cancel |
| `/receipt/[id]` | Receipt with VAT breakdown, print button |
| `/kitchen` | Kitchen tickets, auto-refresh every 10 s, mark items/orders ready |
| `/menu` | Categories and products CRUD, CSV import (`category,name,price,vat_rate`) |
| `/reports` | Daily Z-report: receipts, sales, payment methods, categories, top 10, VAT, hourly chart |

## API

`GET/POST /api/tables` · `GET/POST /api/categories`, `PUT/DELETE /api/categories/[id]` · `GET/POST /api/products`, `GET/PUT/DELETE /api/products/[id]`, `POST /api/products/import` · `GET/POST /api/orders` · `GET/PUT /api/orders/[id]` · `POST /api/orders/[id]/items` · `PUT/DELETE /api/orders/[id]/items/[itemId]` · `POST /api/orders/[id]/send` · `POST /api/orders/[id]/payments` · `GET/PUT /api/kitchen` · `GET /api/reports/daily?date=YYYY-MM-DD`

Money is stored as `Decimal(10,2)` in EUR; prices include VAT (default 24%). Business days use the `Europe/Tallinn` time zone.
