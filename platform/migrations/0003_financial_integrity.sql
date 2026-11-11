-- Bizlano Cloudflare D1 production safety.
-- Atomic stock checks when sales line items are created or drafts issued.
CREATE TRIGGER IF NOT EXISTS trg_stock_on_issued_line
AFTER INSERT ON document_lines
WHEN NEW.product_id IS NOT NULL
AND EXISTS (
  SELECT 1 FROM documents d
  WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.document_id
    AND d.status IN ('issued','part_paid','paid')
    AND d.kind IN ('receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt','service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt','invoice','tax-invoice','recurring-invoice')
)
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM products
    WHERE tenant_id=NEW.tenant_id AND id=NEW.product_id
      AND (track_stock=0 OR stock_milli>=NEW.quantity_milli)
  ) THEN RAISE(ABORT,'Insufficient stock for line item') END;
  UPDATE products SET stock_milli=stock_milli-NEW.quantity_milli,
    updated_at=datetime('now')
  WHERE tenant_id=NEW.tenant_id AND id=NEW.product_id AND track_stock=1;
END;

CREATE TRIGGER IF NOT EXISTS trg_issue_draft_stock
BEFORE UPDATE OF status ON documents
WHEN OLD.status='draft' AND NEW.status='issued'
  AND NEW.kind IN ('receipt','cash-sale','retail-receipt','thermal-receipt','restaurant-bill','wholesale-receipt','service-receipt','rent-receipt','school-fees','medical-receipt','transport-receipt','event-receipt','invoice','tax-invoice','recurring-invoice')
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM document_lines l
    JOIN products p ON p.tenant_id=l.tenant_id AND p.id=l.product_id
    WHERE l.tenant_id=NEW.tenant_id AND l.document_id=NEW.id AND p.track_stock=1
    GROUP BY p.id HAVING p.stock_milli<SUM(l.quantity_milli)
  ) THEN RAISE(ABORT,'Insufficient stock to issue draft') END;
  UPDATE products
  SET stock_milli=stock_milli-COALESCE((
    SELECT SUM(l.quantity_milli) FROM document_lines l
    WHERE l.tenant_id=NEW.tenant_id AND l.document_id=NEW.id AND l.product_id=products.id
  ),0),updated_at=datetime('now')
  WHERE tenant_id=NEW.tenant_id AND track_stock=1 AND id IN (
    SELECT product_id FROM document_lines
    WHERE tenant_id=NEW.tenant_id AND document_id=NEW.id AND product_id IS NOT NULL
  );
END;
CREATE TRIGGER IF NOT EXISTS trg_immutable_issued_financials
BEFORE UPDATE ON documents
WHEN OLD.status IN ('issued','part_paid','paid','voided') AND (
  NEW.total_minor != OLD.total_minor OR
  NEW.discount_minor != OLD.discount_minor OR
  NEW.tax_minor != OLD.tax_minor OR
  NEW.subtotal_minor != OLD.subtotal_minor OR
  NEW.kind != OLD.kind OR
  NEW.tenant_id != OLD.tenant_id OR
  NEW.document_number != OLD.document_number
)
BEGIN SELECT RAISE(ABORT,'Issued document financial fields are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_no_lines_edit_issued
BEFORE UPDATE ON document_lines
WHEN EXISTS(SELECT 1 FROM documents WHERE tenant_id=OLD.tenant_id
 AND id=OLD.document_id AND status!='draft')
BEGIN SELECT RAISE(ABORT,'Cannot edit issued document lines'); END;
CREATE TRIGGER IF NOT EXISTS trg_no_lines_delete_issued
BEFORE DELETE ON document_lines
WHEN EXISTS(SELECT 1 FROM documents WHERE tenant_id=OLD.tenant_id
 AND id=OLD.document_id AND status!='draft')
BEGIN SELECT RAISE(ABORT,'Cannot delete issued document lines'); END;
