-- Bizlano business arms and locations. Additive; never changes historical financial totals.
CREATE TABLE IF NOT EXISTS business_arms (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 id TEXT NOT NULL,slug TEXT NOT NULL,name TEXT NOT NULL,document_prefix TEXT NOT NULL DEFAULT 'BZ',
 contact_phone TEXT,receipt_footer TEXT NOT NULL DEFAULT '',is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
 archived_at TEXT,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL DEFAULT(datetime('now')),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,slug)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_primary_arm ON business_arms(tenant_id) WHERE is_primary=1;
CREATE TABLE IF NOT EXISTS business_locations (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 id TEXT NOT NULL,code TEXT NOT NULL,name TEXT NOT NULL,
 type TEXT NOT NULL DEFAULT 'shop' CHECK(type IN ('shop','warehouse','office','service')),
 address TEXT NOT NULL DEFAULT '',is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
 archived_at TEXT,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL DEFAULT(datetime('now')),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,code)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_primary_location ON business_locations(tenant_id) WHERE is_primary=1;
CREATE TABLE IF NOT EXISTS product_location_stock (
 tenant_id TEXT NOT NULL,location_id TEXT NOT NULL,product_id TEXT NOT NULL,
 stock_milli INTEGER NOT NULL DEFAULT 0 CHECK(stock_milli>=0),
 PRIMARY KEY(tenant_id,location_id,product_id),
 FOREIGN KEY(tenant_id,location_id) REFERENCES business_locations(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS stock_transfers (
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,product_id TEXT NOT NULL,
 from_location_id TEXT NOT NULL,to_location_id TEXT NOT NULL,
 quantity_milli INTEGER NOT NULL CHECK(quantity_milli>0),
 reason TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),
 FOREIGN KEY(tenant_id,from_location_id) REFERENCES business_locations(tenant_id,id),
 FOREIGN KEY(tenant_id,to_location_id) REFERENCES business_locations(tenant_id,id),
 CHECK(from_location_id!=to_location_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_date ON stock_transfers(tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS staff_location_scopes (
 tenant_id TEXT NOT NULL,user_id TEXT NOT NULL,location_id TEXT NOT NULL,
 PRIMARY KEY(tenant_id,user_id,location_id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,location_id) REFERENCES business_locations(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS staff_arm_scopes (
 tenant_id TEXT NOT NULL,user_id TEXT NOT NULL,arm_id TEXT NOT NULL,
 PRIMARY KEY(tenant_id,user_id,arm_id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,arm_id) REFERENCES business_arms(tenant_id,id)
);
-- Existing businesses inherit one business arm and one stock location without paid duplication.
INSERT OR IGNORE INTO business_arms(tenant_id,id,slug,name,document_prefix,is_primary,created_by)
 SELECT id,id,'main',business_name,'BZ',1,created_by FROM tenants;
INSERT OR IGNORE INTO business_locations(tenant_id,id,code,name,type,is_primary,created_by)
 SELECT id,id,'MAIN','Main location','shop',1,created_by FROM tenants;
INSERT OR IGNORE INTO product_location_stock(tenant_id,location_id,product_id,stock_milli)
 SELECT p.tenant_id,p.tenant_id,p.id,p.stock_milli FROM products p;
-- All future workspaces and new products receive a valid primary branch and location.
CREATE TRIGGER IF NOT EXISTS trg_org_tenant_defaults AFTER INSERT ON tenants BEGIN
 INSERT INTO business_arms(tenant_id,id,slug,name,document_prefix,is_primary,created_by)
 VALUES(NEW.id,NEW.id,'main',NEW.business_name,'BZ',1,NEW.created_by);
 INSERT INTO business_locations(tenant_id,id,code,name,type,is_primary,created_by)
 VALUES(NEW.id,NEW.id,'MAIN','Main location','shop',1,NEW.created_by);
END;
CREATE TRIGGER IF NOT EXISTS trg_org_product_default AFTER INSERT ON products BEGIN
 INSERT INTO product_location_stock(tenant_id,location_id,product_id,stock_milli)
 SELECT NEW.tenant_id,l.id,NEW.id,NEW.stock_milli
 FROM business_locations l WHERE l.tenant_id=NEW.tenant_id AND l.is_primary=1;
END;
ALTER TABLE documents ADD COLUMN arm_id TEXT;
ALTER TABLE documents ADD COLUMN location_id TEXT;
CREATE INDEX IF NOT EXISTS idx_docs_org ON documents(tenant_id,location_id,arm_id,issued_on);
-- Existing documents are preserved and remain assigned to the historical main operation.
UPDATE documents SET arm_id=tenant_id WHERE arm_id IS NULL;
UPDATE documents SET location_id=tenant_id WHERE location_id IS NULL;
-- Validate scope without trusting browser-supplied location or arm IDs.
CREATE TRIGGER IF NOT EXISTS trg_org_document_scope_insert
 BEFORE INSERT ON documents
 BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM business_arms WHERE tenant_id=NEW.tenant_id AND id=COALESCE(NEW.arm_id,NEW.tenant_id) AND archived_at IS NULL)
 THEN RAISE(ABORT,'Invalid business arm') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM business_locations WHERE tenant_id=NEW.tenant_id AND id=COALESCE(NEW.location_id,NEW.tenant_id) AND archived_at IS NULL)
 THEN RAISE(ABORT,'Invalid business location') END;
 END;
CREATE TRIGGER IF NOT EXISTS trg_org_document_scope_update
 BEFORE UPDATE OF arm_id,location_id ON documents WHEN OLD.status!='draft'
 BEGIN SELECT RAISE(ABORT,'Cannot change business arm or location on an issued document'); END;
-- Location-stock checks are independent of and in addition to the old global stock checks.
CREATE TRIGGER IF NOT EXISTS trg_org_issued_line_check
 BEFORE INSERT ON document_lines
 WHEN NEW.product_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM products WHERE tenant_id=NEW.tenant_id AND id=NEW.product_id AND track_stock=1)
 AND EXISTS(SELECT 1 FROM documents WHERE tenant_id=NEW.tenant_id AND id=NEW.document_id
 AND status IN ('issued','part_paid','paid') AND kind IN
 ('receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt','service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt','invoice','tax-invoice','recurring-invoice'))
 BEGIN
 SELECT CASE WHEN COALESCE((SELECT s.stock_milli FROM product_location_stock s
 JOIN documents d ON d.tenant_id=s.tenant_id AND d.id=NEW.document_id
 WHERE s.tenant_id=NEW.tenant_id AND s.product_id=NEW.product_id
 AND s.location_id=COALESCE(d.location_id,d.tenant_id)),0)<NEW.quantity_milli
 THEN RAISE(ABORT,'Insufficient stock at this location') END;
 END;
CREATE TRIGGER IF NOT EXISTS trg_org_issued_line_apply
 AFTER INSERT ON document_lines
 WHEN NEW.product_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM products WHERE tenant_id=NEW.tenant_id AND id=NEW.product_id AND track_stock=1)
 AND EXISTS(SELECT 1 FROM documents WHERE tenant_id=NEW.tenant_id AND id=NEW.document_id
 AND status IN ('issued','part_paid','paid') AND kind IN
 ('receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt','service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt','invoice','tax-invoice','recurring-invoice'))
 BEGIN
 UPDATE product_location_stock SET stock_milli=stock_milli-NEW.quantity_milli
 WHERE tenant_id=NEW.tenant_id AND product_id=NEW.product_id
 AND location_id=(SELECT COALESCE(location_id,tenant_id) FROM documents WHERE tenant_id=NEW.tenant_id AND id=NEW.document_id);
 END;
CREATE TRIGGER IF NOT EXISTS trg_org_draft_issue_check
 BEFORE UPDATE OF status ON documents
 WHEN OLD.status='draft' AND NEW.status='issued' AND NEW.kind IN
 ('receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt','service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt','invoice','tax-invoice','recurring-invoice')
 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM document_lines l
 JOIN products p ON p.tenant_id=l.tenant_id AND p.id=l.product_id
 LEFT JOIN product_location_stock s ON s.tenant_id=l.tenant_id AND s.product_id=l.product_id
 AND s.location_id=COALESCE(NEW.location_id,NEW.tenant_id)
 WHERE l.tenant_id=NEW.tenant_id AND l.document_id=NEW.id AND p.track_stock=1
 GROUP BY l.product_id HAVING COALESCE(MAX(s.stock_milli),0)<SUM(l.quantity_milli))
 THEN RAISE(ABORT,'Insufficient stock at this location') END;
 END;
CREATE TRIGGER IF NOT EXISTS trg_org_draft_issue_apply
 AFTER UPDATE OF status ON documents
 WHEN OLD.status='draft' AND NEW.status='issued' AND NEW.kind IN
 ('receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt','service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt','invoice','tax-invoice','recurring-invoice')
 BEGIN
 UPDATE product_location_stock SET stock_milli=stock_milli-COALESCE(
 (SELECT SUM(l.quantity_milli) FROM document_lines l WHERE l.tenant_id=NEW.tenant_id
 AND l.document_id=NEW.id AND l.product_id=product_location_stock.product_id),0)
 WHERE tenant_id=NEW.tenant_id AND location_id=COALESCE(NEW.location_id,NEW.tenant_id)
 AND product_id IN(SELECT product_id FROM document_lines WHERE tenant_id=NEW.tenant_id AND document_id=NEW.id);
 END;
CREATE TRIGGER IF NOT EXISTS trg_org_void_restock
 AFTER UPDATE OF status ON documents
 WHEN NEW.status='voided' AND OLD.status IN ('issued','part_paid','paid')
 BEGIN
 UPDATE product_location_stock SET stock_milli=stock_milli+COALESCE(
 (SELECT SUM(l.quantity_milli) FROM document_lines l WHERE l.tenant_id=NEW.tenant_id
 AND l.document_id=NEW.id AND l.product_id=product_location_stock.product_id),0)
 WHERE tenant_id=NEW.tenant_id AND location_id=COALESCE(NEW.location_id,NEW.tenant_id)
 AND product_id IN(SELECT product_id FROM document_lines WHERE tenant_id=NEW.tenant_id AND document_id=NEW.id);
 END;
-- Atomic transfers change location balances; they do not change the global stock total.
CREATE TRIGGER IF NOT EXISTS trg_org_transfer_stock BEFORE INSERT ON stock_transfers BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM product_location_stock
 WHERE tenant_id=NEW.tenant_id AND product_id=NEW.product_id
 AND location_id=NEW.from_location_id AND stock_milli>=NEW.quantity_milli)
 THEN RAISE(ABORT,'Insufficient stock to transfer') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM business_locations WHERE tenant_id=NEW.tenant_id AND id=NEW.from_location_id AND archived_at IS NULL)
 OR NOT EXISTS (SELECT 1 FROM business_locations WHERE tenant_id=NEW.tenant_id AND id=NEW.to_location_id AND archived_at IS NULL)
 THEN RAISE(ABORT,'Transfer requires active locations') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_org_transfer_apply AFTER INSERT ON stock_transfers BEGIN
 UPDATE product_location_stock SET stock_milli=stock_milli-NEW.quantity_milli
 WHERE tenant_id=NEW.tenant_id AND location_id=NEW.from_location_id AND product_id=NEW.product_id;
 INSERT INTO product_location_stock(tenant_id,location_id,product_id,stock_milli)
 VALUES(NEW.tenant_id,NEW.to_location_id,NEW.product_id,NEW.quantity_milli)
 ON CONFLICT(tenant_id,location_id,product_id) DO UPDATE SET stock_milli=stock_milli+excluded.stock_milli;
END;
CREATE TRIGGER IF NOT EXISTS trg_org_transfer_immutable_update BEFORE UPDATE ON stock_transfers
 BEGIN SELECT RAISE(ABORT,'Stock transfers cannot be rewritten'); END;
CREATE TRIGGER IF NOT EXISTS trg_org_transfer_immutable_delete BEFORE DELETE ON stock_transfers
 BEGIN SELECT RAISE(ABORT,'Stock transfers cannot be deleted'); END;
