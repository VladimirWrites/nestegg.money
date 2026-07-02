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

-- Read-only share snapshots. Each row is a frozen, client-side-encrypted copy of a subset of
-- one user's data, published for a financial advisor (or similar) to view. The decryption key
-- lives only in the URL fragment the user shares, so — exactly like vaults — the server stores
-- ciphertext it cannot read. The share_id is random and NOT linked to any account_id, so a share
-- cannot be traced back to the vault it came from. Rows self-expire (lazy-purged on read/create).
CREATE TABLE IF NOT EXISTS shares (
  share_id    TEXT PRIMARY KEY,   -- random 128-bit id (hex), unlinkable to any account
  blob        TEXT NOT NULL,      -- client-side AES-GCM snapshot (iv.ciphertext, base64)
  expires_at  INTEGER NOT NULL,   -- epoch millis; server-clamped to created_at + 30 days
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares (expires_at);
