-- Immutable proofs of individual payments. These are not new sales or stock events.
-- They refer to an already recorded payment instead of increasing document or invoice totals.
CREATE TABLE IF NOT EXISTS payment_confirmations(
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,payment_id TEXT NOT NULL,
 source_document_id TEXT NOT NULL,
 number TEXT NOT NULL,amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 payload_json TEXT NOT NULL,issued_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,payment_id),UNIQUE(tenant_id,number),
 FOREIGN KEY(tenant_id,payment_id) REFERENCES payments(tenant_id,id),
 FOREIGN KEY(tenant_id,source_document_id) REFERENCES documents(tenant_id,id)
);
CREATE TRIGGER IF NOT EXISTS trg_payment_confirmation_immutable_update BEFORE UPDATE ON payment_confirmations
 BEGIN SELECT RAISE(ABORT,'Payment confirmations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_payment_confirmation_immutable_delete BEFORE DELETE ON payment_confirmations
 BEGIN SELECT RAISE(ABORT,'Payment confirmations are immutable'); END;
-- A quoted transaction may produce one issued sales invoice, not unlimited new invoices.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_issued_invoice_conversion ON documents(tenant_id,origin_document_id)
 WHERE origin_document_id IS NOT NULL AND kind IN('invoice','tax-invoice');
