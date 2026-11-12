-- Bizlano subscription foundation: additive storage only. DO NOT turn on billing from this migration.
-- Each tenant (legal business) owns its own billing lifecycle. All amounts use minor NGN units.
CREATE TABLE IF NOT EXISTS billing_accounts (
 tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
 currency TEXT NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 billing_contact_user_id TEXT REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS price_versions (
 id TEXT PRIMARY KEY, plan_id TEXT NOT NULL,
 term TEXT NOT NULL CHECK(term IN ('monthly','quarterly','six_months','yearly')),
 amount_minor INTEGER NOT NULL CHECK(amount_minor>=0),
 discount_rule TEXT NOT NULL DEFAULT 'none', effective_at TEXT NOT NULL, retired_at TEXT,
 CHECK(retired_at IS NULL OR retired_at>effective_at)
);
CREATE TABLE IF NOT EXISTS subscriptions (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES billing_accounts(tenant_id) ON DELETE RESTRICT,
 plan_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('trial','active','grace','cancelled','expired')),
 price_version_id TEXT REFERENCES price_versions(id),
 provider_subscription_code TEXT UNIQUE,
 term TEXT CHECK(term IN ('monthly','quarterly','six_months','yearly')),
 starts_at TEXT NOT NULL,current_period_end TEXT,
 cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK(cancel_at_period_end IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status ON subscriptions(tenant_id,status);
CREATE TABLE IF NOT EXISTS billing_cycles (
 id TEXT PRIMARY KEY,
 subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
 starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,
 charged_minor INTEGER NOT NULL DEFAULT 0 CHECK(charged_minor>=0),
 status TEXT NOT NULL CHECK(status IN ('draft','pending','paid','failed','void')),
 UNIQUE(subscription_id,starts_at)
);
CREATE TABLE IF NOT EXISTS usage_counters (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 period_wat TEXT NOT NULL CHECK(length(period_wat)=7),
 used INTEGER NOT NULL DEFAULT 0 CHECK(used>=0),
 PRIMARY KEY(tenant_id,period_wat)
);
-- One originating economic sale, one quota event regardless of estimate/invoice/receipt conversions.
CREATE TABLE IF NOT EXISTS usage_events (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 origin_transaction_id TEXT NOT NULL,period_wat TEXT NOT NULL,
 issued_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(tenant_id,origin_transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_usage_events_period ON usage_events(tenant_id,period_wat);
CREATE TABLE IF NOT EXISTS subscription_invoices (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 billing_cycle_id TEXT REFERENCES billing_cycles(id),
 amount_minor INTEGER NOT NULL CHECK(amount_minor>=0),
 currency TEXT NOT NULL DEFAULT 'NGN',
 payment_reference TEXT UNIQUE,
 state TEXT NOT NULL CHECK(state IN ('draft','pending','paid','failed','refunded','void')),
 issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS payment_events (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL,provider_event_id TEXT NOT NULL,
 event_type TEXT NOT NULL,payload_hash TEXT NOT NULL,processed_at TEXT,
 received_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(provider,provider_event_id)
);
CREATE TABLE IF NOT EXISTS discount_eligibility (
 tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
 program TEXT NOT NULL CHECK(program='gws_paid_vendor'),
 verified_at TEXT NOT NULL,valid_until TEXT NOT NULL,
 verification_reference TEXT NOT NULL,gws_vendor_account_hash TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS outbox_notifications (
 id TEXT PRIMARY KEY,tenant_id TEXT REFERENCES tenants(id) ON DELETE RESTRICT,
 dedupe_key TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,recipient TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_notifications(status,next_attempt_at);
CREATE TABLE IF NOT EXISTS billing_audit_events (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 actor_user_id TEXT REFERENCES users(id),action TEXT NOT NULL,entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now'))
);