# Tiffin & Refreshment Billing System

A simple web-based daily entry + end-of-month billing system for company tiffin and nasta/refreshment services. Replaces manual paper registers.

## Start on a computer

First time only:

    cd backend && npm install
    cd ../frontend && npm install && npm run build

Then double-click `start.bat` (Windows), or run `node server.js` inside `backend/` and open http://localhost:5000

## Test from a phone (no laptop)

Deploy to Render (free): put this whole folder in a GitHub repo, then on render.com choose
New > Blueprint > pick the repo. `render.yaml` does the rest.

- `/test` on your deployed URL is a phone-friendly API test console (works even without the frontend build).
- Free tier loses data on restart/sleep. Use it for testing only.
- No login is built in. Do not put real company data on a public URL.

## Structure

    tiffin_billing/
    ├── backend/        Express + SQLite API, PDF/Excel export, public/test.html
    ├── frontend/       React + Vite + Tailwind UI (src/components/ = your 6 screens)
    ├── samples/        Example PDF and Excel bills
    ├── package.json    Root build/start scripts for hosting
    ├── render.yaml     Render deployment blueprint
    └── start.bat       One-click local launcher

## Database tables

companies, company_rates, tiffin_entries, refreshment_entries

## REST API

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/companies` | List (search) / create company |
| PUT | `/api/companies/:id` | Update company |
| PATCH | `/api/companies/:id/toggle` | Toggle active/inactive |
| GET/POST | `/api/rates/:company_id` | Get / save company rates |
| GET/POST | `/api/tiffin-entries` | List (filtered) / create |
| PUT/DELETE | `/api/tiffin-entries/:id` | Update / delete |
| GET | `/api/tiffin-entries/totals` | Running monthly totals |
| GET/POST | `/api/refreshment-entries` | List (filtered) / create |
| PUT/DELETE | `/api/refreshment-entries/:id` | Update / delete |
| GET | `/api/refreshment-entries/totals` | Running monthly totals |
| GET | `/api/bills/{tiffin,refreshment}/preview` | Bill JSON |
| GET | `/api/bills/{tiffin,refreshment}/{pdf,excel}` | Download bill |

## Validation rules

- Company name required and unique
- Date and requisition number required; duplicates (company + date + requisition) blocked
- Counts non-negative; milk litres supports decimals
- Inactive companies cannot receive new entries or have entries moved to them
- Rates cannot be negative; blank rates save as 0

## Tests

`node verify_billing.js` (inside `backend/`) runs on a temporary database and never touches `billing.db`.
