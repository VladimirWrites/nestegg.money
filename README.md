# nestegg — Net Worth Ledger

A deliberately simple net worth tracker: you type asset rows per year, it draws
two graphs. No tax, no estimates, no suggestions. Single-page frontend on
Cloudflare Pages, a Pages Function for encrypted sync, and D1 for storage.
Login is a Mullvad-style account number; data is encrypted in your browser
before it's sent, so the server only ever stores ciphertext.

## What it does

- **Over time**: a stacked bar chart of net worth per year, one colour per asset.
- **Allocation**: a donut of your most recent year, by asset.
- **Entry**: tap a year to open its editor; each row is one asset (name,
  currency, value). Add/remove assets, copy the previous year, rename the year.
- **Groups**: assets can be collected into a group (e.g. several houses under
  "Real estate", several holdings under "Stocks"). The editor shows each group
  as a section with its own subtotal; the charts roll a group up into a single
  segment summing its members. Assets left ungrouped show on their own.
- **Multi-currency**: each row carries its own currency; everything is shown in
  the display currency you pick, converted at current ECB rates (`/api/fx`).
- **Ticker rows**: a row can be a fixed value OR a ticker holding (shares ×
  live price). Enter the symbol Google-style (`AMS:VWRL`) or as a Yahoo symbol;
  `/api/price` looks it up server-side. **Privacy**: only the public symbol is
  ever sent upstream — no bank, no account, no user identifier. The vault stays
  zero-knowledge. Prices are cached in the (encrypted) vault so values show
  offline; hit "Prices" to refresh. No bank-account linking, by design.
- **Sync**: zero-knowledge. Your account number derives an account hash (the only
  thing the server sees) and an AES-GCM key (never leaves the browser).
  **No recovery** — keep the number safe and use Export JSON as your backup.

## Layout

```
networth/
├── public/index.html              # the app
├── functions/api/
│   ├── vault.js                   # GET/PUT/DELETE /api/vault (encrypted blob)
│   ├── fx.js                      # GET /api/fx (ECB rates via Frankfurter)
│   └── price.js                   # GET /api/price?ticker=AMS:VWRL (Yahoo proxy)
├── schema.sql
├── wrangler.toml
└── README.md
```

## Deploy

Requires a Cloudflare account and `npm i -g wrangler` (then `wrangler login`).

1. `wrangler d1 create networth-db` → copy the `database_id` into `wrangler.toml`.
2. `wrangler d1 execute networth-db --remote --file=schema.sql`
3. `wrangler pages deploy public`
4. Open the URL, create an account, save the number.

Local dev: `wrangler pages dev public --d1 DB=networth-db`

## Notes

- New accounts start empty with the current year. Tap the year to add asset
  rows, use "+ Year" for more, or "Reset" to clear everything and start over.
- Historical rows convert at *current* FX rates (no historical FX). For an
  EUR-mostly ledger this is a non-issue.
- In a plain preview with no backend, it runs local-only via localStorage with
  fallback rates; sync and live FX activate once deployed on Pages.
