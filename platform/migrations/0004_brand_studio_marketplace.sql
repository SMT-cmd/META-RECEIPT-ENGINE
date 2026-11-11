-- Bizlano brand studio and trusted marketplace integrations. Additive; preserves legacy data.
CREATE TABLE IF NOT EXISTS tenant_designs (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  template TEXT NOT NULL DEFAULT 'signature',
  accent TEXT NOT NULL DEFAULT '#6935df',
  paper TEXT NOT NULL DEFAULT 'a4' CHECK (paper IN ('a4','letter','80mm','58mm')),
  header_note TEXT NOT NULL DEFAULT '',
  footer_note TEXT NOT NULL DEFAULT 'Thank you for your business.',
  contact TEXT NOT NULL DEFAULT '',
  show_logo INTEGER NOT NULL DEFAULT 1 CHECK(show_logo IN (0,1)),
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS marketplace_link_codes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('globalwebstores')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  redeemed_at TEXT,
  redeemed_vendor_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_link_codes_tenant ON marketplace_link_codes(tenant_id,created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_connections (
  provider TEXT NOT NULL CHECK(provider IN ('globalwebstores')),
  vendor_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connected_by TEXT REFERENCES users(id),
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  disconnected_at TEXT,
  last_sale_at TEXT,
  PRIMARY KEY(provider,vendor_id),
  UNIQUE(provider,tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_connections_tenant ON marketplace_connections(tenant_id);

CREATE TABLE IF NOT EXISTS marketplace_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL,
  document_id TEXT,
  event_type TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  event_created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider,provider_event_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_tenant ON marketplace_events(tenant_id,event_created_at DESC);

CREATE TABLE IF NOT EXISTS receipt_notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id TEXT,
  kind TEXT NOT NULL DEFAULT 'receipt_ready',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  delivered_to_email INTEGER NOT NULL DEFAULT 0 CHECK(delivered_to_email IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT,
  UNIQUE(tenant_id,document_id,kind),
  FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_receipt_notifications_tenant ON receipt_notifications(tenant_id,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_no_modify_external_event
BEFORE UPDATE ON marketplace_events
BEGIN SELECT RAISE(ABORT,'Marketplace events are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_no_delete_external_event
BEFORE DELETE ON marketplace_events
BEGIN SELECT RAISE(ABORT,'Marketplace events are immutable'); END;
