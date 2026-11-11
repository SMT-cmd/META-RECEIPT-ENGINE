-- Bizlano-owned authentication and support records. Additive migration for dedicated D1 only.
-- Existing MetaForge Firebase identities and historic records remain unchanged.
-- email_verified_at is added by the existing 0009_cloudflare_native_accounts.sql.
CREATE TABLE IF NOT EXISTS auth_action_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('verify_email','reset_password')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_action_tokens(user_id,purpose,expires_at);
CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL CHECK(topic IN ('support','privacy','security','billing')),
  sender_email TEXT NOT NULL COLLATE NOCASE,
  message TEXT NOT NULL CHECK(length(message) BETWEEN 12 AND 3000),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','answered','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status,created_at DESC);
