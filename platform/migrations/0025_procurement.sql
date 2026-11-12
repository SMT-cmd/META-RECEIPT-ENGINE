-- Bizlano stock purchasing and suppliers. No external marketplace orders are changed.
CREATE TABLE IF NOT EXISTS business_suppliers (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 id TEXT NOT NULL,name TEXT NOT NULL,phone TEXT,email TEXT,address TEXT,
 archived_at TEXT,created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 PRIMARY KEY(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON business_suppliers(tenant_id,name);
CREATE TABLE IF NOT EXISTS purchase_orders (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 id TEXT NOT NULL,supplier_id TEXT NOT NULL,location_id TEXT NOT NULL,
 supplier_reference TEXT,notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','received','cancelled')),
 total_minor INTEGER NOT NULL CHECK(total_minor>=0),
 created_by TEXT NOT NULL REFERENCES users(id),
 received_by TEXT REFERENCES users(id),received_at TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,supplier_id) REFERENCES business_suppliers(tenant_id,id),
 FOREIGN KEY(tenant_id,location_id) REFERENCES business_locations(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchase_orders(tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,
 order_id TEXT NOT NULL,product_id TEXT NOT NULL,
 quantity_milli INTEGER NOT NULL CHECK(quantity_milli>0),
 unit_cost_minor INTEGER NOT NULL CHECK(unit_cost_minor>=0),
 line_total_minor INTEGER NOT NULL CHECK(line_total_minor>=0),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES purchase_orders(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_order ON purchase_order_lines(tenant_id,order_id);
CREATE TRIGGER IF NOT EXISTS trg_purchase_lines_no_change AFTER UPDATE ON purchase_order_lines
 BEGIN SELECT RAISE(ABORT,'Purchase quantities cannot be overwritten'); END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_lines_no_delete BEFORE DELETE ON purchase_order_lines
 WHEN EXISTS(SELECT 1 FROM purchase_orders WHERE tenant_id=OLD.tenant_id AND id=OLD.order_id AND status!='draft')
 BEGIN SELECT RAISE(ABORT,'Received purchase records are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_order_no_rewrite BEFORE UPDATE OF supplier_id,location_id,total_minor,created_by ON purchase_orders
 BEGIN SELECT RAISE(ABORT,'Purchase order identity is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_receive_validate BEFORE UPDATE OF status ON purchase_orders
 WHEN NEW.status='received'
 BEGIN
  SELECT CASE WHEN OLD.status!='draft' THEN RAISE(ABORT,'Purchase order already processed') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_locations WHERE tenant_id=NEW.tenant_id AND id=NEW.location_id AND archived_at IS NULL)
   THEN RAISE(ABORT,'Purchase location is archived') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM purchase_order_lines WHERE tenant_id=NEW.tenant_id AND order_id=NEW.id)
   THEN RAISE(ABORT,'Purchase must include stock items') END;
  SELECT CASE WHEN (SELECT COALESCE(SUM(line_total_minor),-1) FROM purchase_order_lines WHERE tenant_id=NEW.tenant_id AND order_id=NEW.id)!=NEW.total_minor
   THEN RAISE(ABORT,'Purchase total does not match its items') END;
 END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_receive_stock AFTER UPDATE OF status ON purchase_orders
 WHEN OLD.status='draft' AND NEW.status='received'
 BEGIN
  UPDATE products SET stock_milli=stock_milli+
   (SELECT COALESCE(SUM(l.quantity_milli),0) FROM purchase_order_lines l
    WHERE l.tenant_id=NEW.tenant_id AND l.order_id=NEW.id AND l.product_id=products.id),
   updated_at=datetime('now')
  WHERE tenant_id=NEW.tenant_id AND track_stock=1
   AND id IN(SELECT product_id FROM purchase_order_lines WHERE tenant_id=NEW.tenant_id AND order_id=NEW.id);
  INSERT INTO product_location_stock(tenant_id,location_id,product_id,stock_milli)
  SELECT NEW.tenant_id,NEW.location_id,l.product_id,SUM(l.quantity_milli)
  FROM purchase_order_lines l JOIN products p ON p.tenant_id=l.tenant_id AND p.id=l.product_id
  WHERE l.tenant_id=NEW.tenant_id AND l.order_id=NEW.id AND p.track_stock=1
  GROUP BY l.product_id
  ON CONFLICT(tenant_id,location_id,product_id)
   DO UPDATE SET stock_milli=product_location_stock.stock_milli+excluded.stock_milli;
 END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_received_immutable BEFORE UPDATE ON purchase_orders
 WHEN OLD.status IN('received','cancelled')
 BEGIN SELECT RAISE(ABORT,'Completed purchase orders cannot be changed'); END;
