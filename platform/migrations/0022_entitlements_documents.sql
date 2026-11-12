-- Optional subscription entitlements and a linked document lifecycle.
-- Everything is inactive until explicitly enabled by a verified billing migration.
ALTER TABLE documents ADD COLUMN economic_transaction_id TEXT;
ALTER TABLE documents ADD COLUMN origin_document_id TEXT;
UPDATE documents SET economic_transaction_id=id WHERE economic_transaction_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_docs_economic ON documents(tenant_id,economic_transaction_id);
CREATE INDEX IF NOT EXISTS idx_docs_origin ON documents(tenant_id,origin_document_id);
ALTER TABLE subscription_invoices ADD COLUMN plan_id TEXT;
ALTER TABLE subscription_invoices ADD COLUMN term TEXT;
ALTER TABLE subscription_invoices ADD COLUMN price_version_id TEXT;
ALTER TABLE subscription_invoices ADD COLUMN purchaser_user_id TEXT;
CREATE TABLE IF NOT EXISTS tenant_entitlements (
 tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
 plan_id TEXT NOT NULL DEFAULT 'free',
 transactions_per_month INTEGER NOT NULL DEFAULT 30 CHECK(transactions_per_month>=0),
 saved_design_profiles INTEGER NOT NULL DEFAULT 1 CHECK(saved_design_profiles>=1),
 staff_limit INTEGER NOT NULL DEFAULT 1 CHECK(staff_limit>=1),
 arm_limit INTEGER NOT NULL DEFAULT 1 CHECK(arm_limit>=1),
 location_limit INTEGER NOT NULL DEFAULT 1 CHECK(location_limit>=1),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 starts_at TEXT,ends_at TEXT,updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE TABLE IF NOT EXISTS document_design_profiles (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 id TEXT NOT NULL,name TEXT NOT NULL,template TEXT NOT NULL,
 accent TEXT NOT NULL DEFAULT '#6935df',secondary_color TEXT NOT NULL DEFAULT '#19223b',
 font_family TEXT NOT NULL DEFAULT 'modern',header_note TEXT NOT NULL DEFAULT '',
 footer_note TEXT NOT NULL DEFAULT 'Thank you for your business.',
 created_by TEXT NOT NULL REFERENCES users(id),
 archived_at TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),
 PRIMARY KEY(tenant_id,id)
);
ALTER TABLE business_arms ADD COLUMN design_profile_id TEXT;
CREATE TRIGGER IF NOT EXISTS trg_profile_limit BEFORE INSERT ON document_design_profiles
 WHEN NEW.archived_at IS NULL AND EXISTS(SELECT 1 FROM tenant_entitlements e WHERE e.tenant_id=NEW.tenant_id AND e.enabled=1
 AND (SELECT count(*) FROM document_design_profiles WHERE tenant_id=NEW.tenant_id AND archived_at IS NULL)>=e.saved_design_profiles)
 BEGIN SELECT RAISE(ABORT,'Design profile limit reached'); END;
CREATE TRIGGER IF NOT EXISTS trg_arm_limit BEFORE INSERT ON business_arms
 WHEN NEW.archived_at IS NULL AND EXISTS(SELECT 1 FROM tenant_entitlements e WHERE e.tenant_id=NEW.tenant_id AND e.enabled=1
 AND (SELECT count(*) FROM business_arms WHERE tenant_id=NEW.tenant_id AND archived_at IS NULL)>=e.arm_limit)
 BEGIN SELECT RAISE(ABORT,'Business arm limit reached'); END;
CREATE TRIGGER IF NOT EXISTS trg_location_limit BEFORE INSERT ON business_locations
 WHEN NEW.archived_at IS NULL AND EXISTS(SELECT 1 FROM tenant_entitlements e WHERE e.tenant_id=NEW.tenant_id AND e.enabled=1
 AND (SELECT count(*) FROM business_locations WHERE tenant_id=NEW.tenant_id AND archived_at IS NULL)>=e.location_limit)
 BEGIN SELECT RAISE(ABORT,'Location limit reached'); END;
CREATE TRIGGER IF NOT EXISTS trg_staff_limit BEFORE INSERT ON memberships
 WHEN NEW.disabled_at IS NULL AND EXISTS(SELECT 1 FROM tenant_entitlements e WHERE e.tenant_id=NEW.tenant_id AND e.enabled=1
 AND (SELECT count(*) FROM memberships WHERE tenant_id=NEW.tenant_id AND disabled_at IS NULL)>=e.staff_limit)
 BEGIN SELECT RAISE(ABORT,'Staff limit reached'); END;
CREATE TRIGGER IF NOT EXISTS trg_usage_limit BEFORE INSERT ON usage_events
 WHEN EXISTS(SELECT 1 FROM tenant_entitlements e WHERE e.tenant_id=NEW.tenant_id AND e.enabled=1
 AND COALESCE((SELECT used FROM usage_counters WHERE tenant_id=NEW.tenant_id AND period_wat=NEW.period_wat),0)>=e.transactions_per_month)
 BEGIN SELECT RAISE(ABORT,'Monthly transaction allowance reached'); END;
CREATE TRIGGER IF NOT EXISTS trg_document_economic_immutable BEFORE UPDATE OF economic_transaction_id,origin_document_id ON documents
 WHEN OLD.status IN ('issued','part_paid','paid','voided')
 BEGIN SELECT RAISE(ABORT,'Issued document transaction lineage is immutable'); END;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_one_active_tenant ON subscriptions(tenant_id) WHERE status IN('active','grace');
