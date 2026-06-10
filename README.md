# nestegg.money — private net worth & salary tracker

A deliberately simple, zero-knowledge personal ledger. Single Cloudflare Worker
serving a static frontend (no framework, no bundler) plus three small API
routes, with D1 for storage. Login is a Mullvad-style account number; data is
encrypted in your browser before it's sent, so the server only ever stores
ciphertext.

## What it does

- **Over time**: a stacked bar chart of net worth per year, one colour per
  asset (or category), with a net-worth line when liabilities exist.
- **Allocation**: a donut of your most recent year.
- **Entry**: tap a year to open its editor; each row is one asset (name,
  currency, value). Add/remove assets, copy the previous year, rename the year.
- **Categories**: assets can be tagged into a category (e.g. several holdings
  under "Stocks"). The editor shows each category as a section with a
  subtotal; charts roll a category up into one segment.
- **Long-term assets & loans**: a car or house can depreciate/appreciate
  continuously and carry a loan with a real amortization schedule — extra
  payments, rate-fixed periods, payment-or-term entry. Its net value is
  injected into every year you own it.
- **Multi-currency**: each row carries its own currency; everything is shown
  in your chosen display currency at ECB rates (`/api/fx`). Past years use
  that year's year-end rates.
- **Ticker/crypto rows**: shares × live price via `/api/price` (Yahoo proxy).
  Past years freeze to that year's closing price. Only the public symbol is
  sent upstream — never an account or user identifier.
- **Salary**: monthly net pay per person, with events (raises, job changes),
  a dual-axis chart, and paste-from-spreadsheet import.
- **Forecast & retirement**: project net worth forward (contributions,
  growth, scenario band, FIRE goal) and simulate drawdown with a state
  pension (flat amount or German Rentenpunkte).
- **Sync**: zero-knowledge. The account number derives an account hash (the
  only thing the server sees) and an AES-GCM key (never leaves the browser).
  Multi-device edits merge per record with tombstones, newest wins.
  **No recovery** — keep the number safe; Export JSON is the real backup.

## Layout

```
nestegg.money/
├── src/index.js          # the Worker: /api/fx, /api/price, /api/vault + routing
├── public/
│   ├── index.html        # marketing landing (root domain)
│   ├── dashboard.html    # the app (dashboard subdomain / *.workers.dev)
│   ├── css/              # base, landing, app styles
│   └── js/               # core (state/math/sync), gate, charts, networth,
│                         # assets, salary, wire — global scope, loaded in order
├── schema.sql            # D1: one row per account (hash → encrypted blob)
└── wrangler.toml
```

The Worker runs first (`run_worker_first`) so it can route the landing page vs
the app by hostname and handle `/api/*`; everything else falls through to the
static assets binding.

## Deploy

Requires a Cloudflare account and `npm i -g wrangler` (then `wrangler login`).

1. `wrangler d1 create networth-db` → copy the `database_id` into `wrangler.toml`.
2. `wrangler d1 execute networth-db --remote --file=schema.sql`
3. `wrangler deploy`
4. Open the URL, create an account, save the number.

Local dev: `wrangler dev` (serves the app with live API + local D1).

Tests (loan math, multi-device merge, tokens): `node --test tests/core.test.mjs`

## Notes

- New accounts start empty with the current year. Tap the year to add asset
  rows, use "+ Year" for more, or "Reset" to start over.
- In a plain preview with no backend it runs local-only via localStorage with
  fallback FX rates; sync, live FX and prices activate once deployed.
- The server can't read your figures, but it can see the size of the
  encrypted blob, sync times, and your IP — stated plainly in the app footer.
