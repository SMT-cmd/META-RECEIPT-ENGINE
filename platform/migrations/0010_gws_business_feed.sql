-- Idempotent, signed Global Webstores business-data feed.
-- Does not change Bizlano's authoritative receipts, payment ledger, or local stock.
CREATE TABLE IF NOT EXISTS marketplace_feed_events (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 vendor_id TEXT NOT NULL,
 event_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('catalog.product.upsert','catalog.product.deleted','order.status.updated','order.refunded','payout.settled')),
 event_hash TEXT NOT NULL,
 order_id TEXT,
 received_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(vendor_id,event_id)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_feed_tenant ON marketplace_feed_events(tenant_id,received_at DESC);
CREATE TABLE IF NOT EXISTS marketplace_catalog_products (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 product_id TEXT NOT NULL,
 name TEXT NOT NULL,
 sku TEXT,
 price_minor INTEGER NOT NULL DEFAULT 0 CHECK(price_minor>=0),
 stock_milli INTEGER CHECK(stock_milli IS NULL OR stock_milli>=0),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(tenant_id,product_id)
);
CREATE TABLE IF NOT EXISTS marketplace_order_status (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 order_id TEXT NOT NULL,
 state TEXT NOT NULL,
 tracking_reference TEXT,
 last_event_id TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(tenant_id,order_id)
);
CREATE TABLE IF NOT EXISTS marketplace_adjustments (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 refund_id TEXT NOT NULL,
 order_id TEXT NOT NULL,
 amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 reason TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(tenant_id,refund_id)
);
CREATE TABLE IF NOT EXISTS marketplace_settlements (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 payout_id TEXT NOT NULL,
 order_id TEXT NOT NULL,
 amount_minor INTEGER NOT NULL CHECK(amount_minor>=0),
 reference TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(tenant_id,payout_id)
);
