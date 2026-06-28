// nestegg.money — Cloudflare Worker (static assets + API).
//
// Static files in ./public are served automatically by the assets binding.
// This Worker only runs for paths that don't match a static asset, which is
// where the /api/* routes live. Everything here was migrated 1:1 from the
// former Pages Functions in functions/api/*.
//
// /api/calc/* exposes the shared finance math (lib/finance-math.js) as stateless calculators.
// They are pure: no storage, no auth, no live prices, no FX lookup (rate is an input).
import {
  amortization, loanPayoff, futureValue, futureValueOfContributions, cagr,
  savingsRate, fxConvert, depreciate, straightLineDepreciation,
} from "../public/lib/finance-math.js";

function json(obj, status = 200, ttl = 0) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": ttl ? `public, max-age=${ttl}` : "no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// /api/fx — EUR-anchored exchange rates (ECB data via Frankfurter, free, no key)
// rates[CCY] = units of CCY per 1 EUR.
// ---------------------------------------------------------------------------
async function fxGet(request) {
  const date = new URL(request.url).searchParams.get("date");   // YYYY-MM-DD → that day's ECB rates
  const hist = date && /^\d{4}-\d{2}-\d{2}$/.test(date);
  try {
    // Frankfurter returns the most recent rates on/before a given date (handles weekends/holidays).
    const url = `https://api.frankfurter.app/${hist ? encodeURIComponent(date) : "latest"}?from=EUR`;
    const r = await fetch(url, { cf: { cacheTtl: hist ? 86400 : 3600, cacheEverything: true } });
    if (!r.ok) return json({ error: "upstream " + r.status }, 502);
    const d = await r.json();
    const rates = Object.assign({ EUR: 1 }, d.rates || {});
    return json({ base: "EUR", rates, date: d.date }, 200, hist ? 86400 : 3600);
  } catch (e) {
    return json({ error: "fetch failed" }, 502);
  }
}

// ---------------------------------------------------------------------------
// /api/price?ticker=AMS:VWRL — proxies Yahoo Finance's public chart endpoint.
// Only the public symbol is sent upstream; no account or user identifier.
// ---------------------------------------------------------------------------
const EXMAP = {
  AMS: ".AS", EPA: ".PA", ETR: ".DE", XETRA: ".DE", GER: ".DE", FRA: ".F",
  LON: ".L", LSE: ".L", BIT: ".MI", BME: ".MC", EBR: ".BR", ELI: ".LS",
  VIE: ".VI", STO: ".ST", HEL: ".HE", CPH: ".CO", OSL: ".OL", WSE: ".WA",
  SWX: ".SW", VTX: ".SW", TSE: ".TO", TSX: ".TO", ASX: ".AX",
  NASDAQ: "", NYSE: "", NYSEARCA: "", ARCA: "", AMEX: "", BATS: "", OTCMKTS: "",
};
function toYahoo(t) {
  t = (t || "").trim();
  if (t.includes(":")) {
    const [ex, sym] = t.split(":");
    const suf = EXMAP[ex.toUpperCase()];
    return sym.toUpperCase() + (suf !== undefined ? suf : "");
  }
  return t.toUpperCase();
}
async function priceGet(request) {
  const u = new URL(request.url);
  const t = u.searchParams.get("ticker");
  if (!t) return json({ error: "no ticker" }, 400);
  const symbol = toYahoo(t);
  const yearStr = u.searchParams.get("year");
  try {
    // Historical: the closing price for a given calendar year (last trading day of it).
    if (yearStr) {
      const y = parseInt(yearStr, 10);
      if (!(y >= 1970 && y <= 3000)) return json({ error: "bad year" }, 400);
      const p1 = Math.floor(Date.UTC(y, 0, 1) / 1000);
      const p2 = Math.floor(Date.UTC(y, 11, 31, 23, 59, 59) / 1000);
      const hurl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`;
      const hr = await fetch(hurl, {
        headers: { "user-agent": "Mozilla/5.0", "accept": "application/json" },
        cf: { cacheTtl: 86400, cacheEverything: true },
      });
      // 4xx from Yahoo means no data for this symbol/range (e.g. crypto before it existed) —
      // report it as a clean 404 "no price", not a 502 server error. Reserve 502 for real 5xx.
      if (!hr.ok) return json({ error: "no data", symbol, status: hr.status }, hr.status >= 500 ? 502 : 404);
      const hd = await hr.json();
      const res = hd && hd.chart && hd.chart.result && hd.chart.result[0];
      const closes = res && res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close;
      if (!res || !closes) return json({ error: "no price", symbol }, 404);
      let px = null;
      for (let i = closes.length - 1; i >= 0; i--) { if (closes[i] != null) { px = closes[i]; break; } }
      if (px == null) return json({ error: "no price", symbol }, 404);
      return json({ ticker: t, symbol, price: px, currency: (res.meta && res.meta.currency) || "USD", year: y }, 200, 86400);
    }
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const r = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0", "accept": "application/json" },
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (!r.ok) return json({ error: "upstream " + r.status, symbol }, 502);
    const d = await r.json();
    const meta = d && d.chart && d.chart.result && d.chart.result[0] && d.chart.result[0].meta;
    if (!meta || meta.regularMarketPrice == null) return json({ error: "no price", symbol }, 404);
    const prevClose = meta.chartPreviousClose != null ? meta.chartPreviousClose : (meta.previousClose != null ? meta.previousClose : meta.regularMarketPrice);
    return json({ ticker: t, symbol, price: meta.regularMarketPrice, prevClose, currency: meta.currency || "USD", asOf: meta.regularMarketTime || null }, 200, 60);
  } catch (e) {
    return json({ error: "fetch failed", symbol }, 502);
  }
}

// ---------------------------------------------------------------------------
// /api/vault — zero-knowledge encrypted blob store keyed by account hash.
// The id is sent in the X-Vault-Id header (GET/DELETE) or the body (PUT), never the URL,
// so it can't leak via access logs / Referer / browser history.
// GET    [X-Vault-Id: <hash>]  -> { blob, updated_at } | 404
// PUT    { id, blob }          -> { ok: true }
// DELETE [X-Vault-Id: <hash>]  -> { ok: true }
// ---------------------------------------------------------------------------
const ID_RE = /^[a-f0-9]{64}$/;          // SHA-256 hex
const MAX_BLOB = 256_000;                // ceiling; real blobs are ~1 KB avg, ~11 KB max (gzipped) — this is generous
const CREATE_WINDOW_MS = 86_400_000;     // 24h rate-limit window for new-vault creation
const CREATE_LIMIT = 20;                 // max new vaults one IP can create per window

// The id comes from a header so it never lands in access logs / Referer / browser history
// the way a ?id= query string would.
const vaultId = (request) => request.headers.get("X-Vault-Id");

async function vaultGet(request, env) {
  const id = vaultId(request);
  if (!id || !ID_RE.test(id)) return json({ error: "bad id" }, 400);
  const row = await env.DB.prepare(
    "SELECT blob, updated_at FROM vaults WHERE account_id = ?"
  ).bind(id).first();
  if (!row) return json({ error: "not found" }, 404);
  return json({ blob: row.blob, updated_at: row.updated_at });
}

async function vaultPut(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: "bad json" }, 400); }

  const { id, blob } = body || {};
  if (!id || !ID_RE.test(id)) return json({ error: "bad id" }, 400);
  if (typeof blob !== "string" || blob.length === 0 || blob.length > MAX_BLOB) {
    return json({ error: "bad blob" }, 400);
  }

  // Only NEW-vault creation is rate-limited; updates to an existing vault are unlimited.
  // This caps how many rows a single IP can add, which is what stops table-stuffing.
  const existing = await env.DB.prepare("SELECT 1 AS x FROM vaults WHERE account_id = ?").bind(id).first();
  if (!existing) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now(), since = now - CREATE_WINDOW_MS;
    await env.DB.prepare("DELETE FROM create_log WHERE ts < ?").bind(since).run(); // expire old IPs
    const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM create_log WHERE ip = ? AND ts > ?").bind(ip, since).first();
    if ((c && c.n ? c.n : 0) >= CREATE_LIMIT) return json({ error: "rate limited" }, 429);
    await env.DB.prepare("INSERT INTO create_log (ip, ts) VALUES (?1, ?2)").bind(ip, now).run();
  }

  await env.DB.prepare(
    `INSERT INTO vaults (account_id, blob, updated_at)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(account_id) DO UPDATE SET blob = ?2, updated_at = ?3`
  ).bind(id, blob, Date.now()).run();

  return json({ ok: true });
}

async function vaultDelete(request, env) {
  const id = vaultId(request);
  if (!id || !ID_RE.test(id)) return json({ error: "bad id" }, 400);
  await env.DB.prepare("DELETE FROM vaults WHERE account_id = ?").bind(id).run();
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// /api/calc/* — stateless calculators over lib/finance-math.js. Pure: no storage,
// no auth, no live data. CORS-open (they carry no secrets). POST JSON in, JSON out.
// ---------------------------------------------------------------------------
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};
function calcJson(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS },
  });
}
const CALCS = {
  "amortization": (b) => amortization(b),
  "loan-payoff": (b) => loanPayoff(b, b.extraMonthly),
  "future-value": (b) => ({ value: futureValue(b.principal, b.annualRatePct, b.years) }),
  "contributions": (b) => ({ value: futureValueOfContributions(b.monthly, b.annualRatePct, b.months, b.contribGrowthPct || 0) }),
  "cagr": (b) => ({ value: cagr(b.begin, b.end, b.years) }),
  "savings-rate": (b) => ({ value: savingsRate(b.income, b.savings) }),
  "fx-convert": (b) => ({ value: fxConvert(b.amount, b.rate) }),
  "depreciate": (b) => ({ value: depreciate(b.value, b.annualRatePct, b.years, !!b.up) }),
  "straight-line-depreciation": (b) => ({ value: straightLineDepreciation(b.value, b.salvage, b.usefulYears, b.yearsElapsed) }),
};
async function calcRoute(request, pathname) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  // index: list available calculators
  if (pathname === "/api/calc" || pathname === "/api/calc/") {
    return calcJson({ calculators: Object.keys(CALCS), docs: "/docs/calculators.md" });
  }
  if (request.method !== "POST") return calcJson({ error: "method not allowed; POST a JSON body" }, 405);
  const name = pathname.slice("/api/calc/".length);
  const fn = CALCS[name];
  if (!fn) return calcJson({ error: "unknown calculator", calculators: Object.keys(CALCS) }, 404);
  let body;
  try { body = await request.json(); } catch (e) { return calcJson({ error: "invalid JSON body" }, 400); }
  if (!body || typeof body !== "object") return calcJson({ error: "body must be a JSON object" }, 400);
  try { return calcJson(fn(body)); }
  catch (e) { return calcJson({ error: "calculation failed", detail: String((e && e.message) || e) }, 400); }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const method = request.method;

    if (pathname === "/api/fx") {
      if (method === "GET") return fxGet(request);
      return json({ error: "method not allowed" }, 405);
    }

    if (pathname === "/api/price") {
      if (method === "GET") return priceGet(request);
      return json({ error: "method not allowed" }, 405);
    }

    if (pathname === "/api/vault") {
      try {
        if (method === "GET") return await vaultGet(request, env);
        if (method === "PUT") return await vaultPut(request, env);
        if (method === "DELETE") return await vaultDelete(request, env);
        return json({ error: "method not allowed" }, 405);
      } catch (e) {
        return json({ error: "storage error" }, 500);
      }
    }

    if (pathname === "/api/calc" || pathname.startsWith("/api/calc/")) {
      return calcRoute(request, pathname);
    }

    // Host/path routing: marketing landing at the root domain, app at the dashboard
    // subdomain. Until the custom domain is wired, *.workers.dev serves the app so
    // existing access keeps working. /dashboard and /landing are universal bridges.
    const url = new URL(request.url);
    const host = url.hostname;
    const appHost = host.startsWith("dashboard.") || host.endsWith(".workers.dev") || host === "localhost" || host === "127.0.0.1";
    const serve = (file) => env.ASSETS.fetch(new Request(new URL(file, url.origin), request));
    if (pathname === "/dashboard" || pathname === "/dashboard/") return serve("/dashboard.html");
    if (pathname === "/landing") return serve("/index.html");
    if (pathname === "/" || pathname === "") return serve(appHost ? "/dashboard.html" : "/index.html");
    // Everything else: serve the static asset by path (404 if missing).
    return env.ASSETS.fetch(request);
  },
};
