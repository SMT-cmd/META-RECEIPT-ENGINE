-- Private, revocable lookup credentials for Bizlano receipts.
-- Codes are derived using a Worker-only HMAC key and persisted only as SHA-256 hashes.
-- Business slugs remain stable: future domain routing never migrates or duplicates rows.
CREATE TABLE IF NOT EXISTS receipt_recovery_codes (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 document_id TEXT NOT NULL,
 code_hash TEXT NOT NULL UNIQUE,
 issued_at TEXT NOT NULL DEFAULT (datetime('now')),
 revoked_at TEXT,
 last_used_at TEXT,
 PRIMARY KEY(tenant_id,document_id),
 FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_hash ON receipt_recovery_codes(code_hash) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS recovery_attempts (
 attempt_key TEXT NOT NULL PRIMARY KEY,
 count INTEGER NOT NULL DEFAULT 0 CHECK(count>=0),
 period_start INTEGER NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_period ON recovery_attempts(period_start);

-- Manual customer email is optional. Searching by name, product, or order ID alone
-- is NOT a public ownership proof. Customer history requires a verified email identity.
