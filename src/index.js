// nestegg.money — Cloudflare Worker (static assets + API).
//
// Static files in ./public are served automatically by the assets binding.
// This Worker only runs for paths that don't match a static asset, which is
// where the /api/* routes live. Everything here was migrated 1:1 from the
// former Pages Functions in functions/api/*.

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
      const y = parseInt(yearStr);
      if (!(y >= 1970 && y <= 3000)) return json({ error: "bad year" }, 400);
      const p1 = Math.floor(Date.UTC(y, 0, 1) / 1000);
      const p2 = Math.floor(Date.UTC(y, 11, 31, 23, 59, 59) / 1000);
      const hurl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`;
      const hr = await fetch(hurl, {
        headers: { "user-agent": "Mozilla/5.0", "accept": "application/json" },
        cf: { cacheTtl: 86400, cacheEverything: true },
      });
      if (!hr.ok) return json({ error: "upstream " + hr.status, symbol }, 502);
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
    return json({ ticker: t, symbol, price: meta.regularMarketPrice, prevClose, currency: meta.currency || "USD" }, 200, 60);
  } catch (e) {
    return json({ error: "fetch failed", symbol }, 502);
  }
}

// ---------------------------------------------------------------------------
// /api/vault — zero-knowledge encrypted blob store keyed by account hash.
// GET    ?id=<hash>            -> { blob, updated_at } | 404
// PUT    { id, blob }          -> { ok: true }
// DELETE ?id=<hash>            -> { ok: true }
// ---------------------------------------------------------------------------
const ID_RE = /^[a-f0-9]{64}$/;          // SHA-256 hex
const MAX_BLOB = 2_000_000;              // ~2 MB ceiling

async function vaultGet(request, env) {
  const id = new URL(request.url).searchParams.get("id");
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

  await env.DB.prepare(
    `INSERT INTO vaults (account_id, blob, updated_at)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(account_id) DO UPDATE SET blob = ?2, updated_at = ?3`
  ).bind(id, blob, Date.now()).run();

  return json({ ok: true });
}

async function vaultDelete(request, env) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !ID_RE.test(id)) return json({ error: "bad id" }, 400);
  await env.DB.prepare("DELETE FROM vaults WHERE account_id = ?").bind(id).run();
  return json({ ok: true });
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
      if (method === "GET") return vaultGet(request, env);
      if (method === "PUT") return vaultPut(request, env);
      if (method === "DELETE") return vaultDelete(request, env);
      return json({ error: "method not allowed" }, 405);
    }

    // Non-API path that didn't match a static asset.
    return new Response("Not found", { status: 404 });
  },
};
