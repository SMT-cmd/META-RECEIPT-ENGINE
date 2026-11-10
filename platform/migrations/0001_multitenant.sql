-- MetaForge / future-brand multi-business schema for Cloudflare D1.
-- Apply only to a NEW database in the dedicated non-GWS Cloudflare account.
-- All cross-business data requires tenant_id in WHERE clauses and bound SQL parameters.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  disabled_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS platform_admins (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  business_name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'general',
  currency TEXT NOT NULL DEFAULT 'NGN',
  timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  logo_url TEXT,
  brand_color TEXT NOT NULL DEFAULT '#4657db',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  disabled_at TEXT
);
CREATE TABLE IF NOT EXISTS memberships (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','manager','accountant','cashier','sales','viewer')),
  invited_by TEXT,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  disabled_at TEXT,
  PRIMARY KEY (tenant_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id,tenant_id);
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','accountant','cashier','sales','viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON invitations(tenant_id,expires_at);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name ON customers(tenant_id,name);
CREATE TABLE IF NOT EXISTS products (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT NOT NULL DEFAULT 'unit',
  category TEXT,
  price_minor INTEGER NOT NULL DEFAULT 0 CHECK(price_minor>=0),
  cost_minor INTEGER NOT NULL DEFAULT 0 CHECK(cost_minor>=0),
  stock_milli INTEGER NOT NULL DEFAULT 0 CHECK(stock_milli>=0),
  low_stock_milli INTEGER NOT NULL DEFAULT 0,
  track_stock INTEGER NOT NULL DEFAULT 1 CHECK(track_stock IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_sku ON products(tenant_id,sku) WHERE sku IS NOT NULL AND sku!='';

CREATE TABLE IF NOT EXISTS documents (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_number TEXT NOT NULL,
  kind TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'signature',
  customer_id TEXT,
  recipient_name TEXT NOT NULL DEFAULT '',
  issued_on TEXT NOT NULL,
  due_on TEXT,
  currency TEXT NOT NULL DEFAULT 'NGN',
  subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_minor>=0),
  discount_minor INTEGER NOT NULL DEFAULT 0 CHECK(discount_minor>=0),
  tax_minor INTEGER NOT NULL DEFAULT 0 CHECK(tax_minor>=0),
  shipping_minor INTEGER NOT NULL DEFAULT 0 CHECK(shipping_minor>=0),
  total_minor INTEGER NOT NULL DEFAULT 0 CHECK(total_minor>=0),
  paid_minor INTEGER NOT NULL DEFAULT 0 CHECK(paid_minor>=0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','issued','part_paid','paid','voided')),
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,document_number),
  FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_docs_tenant_status_date ON documents(tenant_id,status,issued_on);
CREATE TABLE IF NOT EXISTS document_lines (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  product_id TEXT,
  description TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL CHECK(quantity_milli>0),
  unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor>=0),
  line_total_minor INTEGER NOT NULL CHECK(line_total_minor>=0),
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_lines_document ON document_lines(tenant_id,document_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
  method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  recorded_by TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_payments_doc ON payments(tenant_id,document_id);
CREATE TABLE IF NOT EXISTS stock_events (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  document_id TEXT,
  delta_milli INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),
  FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
  spent_on TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON expenses(tenant_id,spent_on);
CREATE TABLE IF NOT EXISTS sales_targets (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  target_minor INTEGER NOT NULL CHECK(target_minor>0),
  basis TEXT NOT NULL DEFAULT 'issued_sales' CHECK(basis IN ('issued_sales','payments_received')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_targets_tenant_period ON sales_targets(tenant_id,period_start,period_end);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(tenant_id,conversation_id,sent_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_date ON audit_events(tenant_id,created_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  email TEXT NOT NULL COLLATE NOCASE,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(email,attempted_at);

-- Payment insertion is the single authoritative mutation of the amount received.
-- This trigger runs in the same D1 transaction as the journal INSERT.
CREATE TRIGGER IF NOT EXISTS trg_payment_validate
BEFORE INSERT ON payments
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM documents
    WHERE tenant_id=NEW.tenant_id AND id=NEW.document_id
      AND status IN ('issued','part_paid')
      AND paid_minor + NEW.amount_minor <= total_minor
  ) THEN RAISE(ABORT,'Payment exceeds balance or document is not payable') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_apply
AFTER INSERT ON payments
BEGIN
  UPDATE documents SET
    paid_minor=paid_minor+NEW.amount_minor,
    status=CASE WHEN paid_minor+NEW.amount_minor=total_minor THEN 'paid' ELSE 'part_paid' END,
    updated_at=datetime('now')
  WHERE tenant_id=NEW.tenant_id AND id=NEW.document_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_document_payment_guard
BEFORE UPDATE OF paid_minor ON documents
WHEN NEW.paid_minor < 0 OR NEW.paid_minor > NEW.total_minor
BEGIN
  SELECT RAISE(ABORT,'Invalid paid amount');
END;
