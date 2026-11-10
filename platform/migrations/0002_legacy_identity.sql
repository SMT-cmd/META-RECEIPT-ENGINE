-- Optional legacy-account bridge for the future Cloudflare D1 deployment.
-- This migration does NOT access Firebase or Supabase and must not run on
-- Global Webstores' database.
-- Link users ONLY after a server verifies a Firebase ID token's signature,
-- issuer, audience, expiry, and subject (metaforge-6afdf).
-- Never trust a client-submitted uid or email alone.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS legacy_identity_links (
  provider TEXT NOT NULL CHECK(provider IN ('firebase-metaforge')),
  legacy_uid TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(provider,legacy_uid),
  UNIQUE(provider,user_id)
);

CREATE TABLE IF NOT EXISTS legacy_migration_jobs (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending','review','importing','complete','partial','failed')),
  source_platform TEXT NOT NULL CHECK(source_platform IN ('firebase-metaforge','browser-backup')),
  archive_hash TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0 CHECK(source_count>=0),
  imported_count INTEGER NOT NULL DEFAULT 0 CHECK(imported_count>=0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK(skipped_count>=0),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  details TEXT,
  PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,source_platform,archive_hash)
);
CREATE INDEX IF NOT EXISTS idx_legacy_jobs_tenant_state
  ON legacy_migration_jobs(tenant_id,state,started_at);

CREATE TABLE IF NOT EXISTS legacy_document_sources (
  tenant_id TEXT NOT NULL,
  legacy_source_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  original_document_number TEXT,
  new_document_id TEXT,
  review_state TEXT NOT NULL DEFAULT 'needs_review'
    CHECK(review_state IN ('needs_review','approved','skipped')),
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,legacy_source_id),
  FOREIGN KEY(tenant_id,job_id) REFERENCES legacy_migration_jobs(tenant_id,id),
  FOREIGN KEY(tenant_id,new_document_id) REFERENCES documents(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_legacy_sources_job
  ON legacy_document_sources(tenant_id,job_id);

-- Raw source backups containing customer information should be held by the
-- customer or, with consent, in PRIVATE R2 storage with access controlled by
-- a tenant-aware Worker. These D1 tables store only hashes and references.
-- The original Firebase short_urls and receipts are not removed automatically.
