-- Net Worth Ledger — D1 schema
-- One row per account. The server only ever sees the account hash and an
-- encrypted blob; it has no way to read the financial data inside.

CREATE TABLE IF NOT EXISTS vaults (
  account_id  TEXT PRIMARY KEY,   -- SHA-256 hash derived from the account number
  blob        TEXT NOT NULL,      -- client-side AES-GCM encrypted state (iv.ciphertext, base64)
  updated_at  INTEGER NOT NULL    -- epoch millis of last write
);
