-- Net Worth Ledger — D1 schema
-- One row per account. The server only ever sees the account hash and an
-- encrypted blob; it has no way to read the financial data inside.

CREATE TABLE IF NOT EXISTS vaults (
  account_id  TEXT PRIMARY KEY,   -- SHA-256 hash derived from the account number
  blob        TEXT NOT NULL,      -- client-side AES-GCM encrypted state (iv.ciphertext, base64)
  updated_at  INTEGER NOT NULL    -- epoch millis of last write
);

-- Short-lived log of new-vault creations per IP, used only to rate-limit account creation
-- and stop table-stuffing. Rows older than the rate-limit window are deleted on each create,
-- so an IP is not retained beyond ~24h. Not linked to any account.
CREATE TABLE IF NOT EXISTS create_log (
  ip  TEXT NOT NULL,
  ts  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_create_log_ip_ts ON create_log (ip, ts);
