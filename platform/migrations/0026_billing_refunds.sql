-- Separate, provider-confirmed refunds for prepaid Bizlano subscription invoices.
-- Does not touch business customer-payment journals, product inventory, or GWS payouts.
CREATE TABLE IF NOT EXISTS billing_refunds(
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 invoice_id TEXT NOT NULL REFERENCES subscription_invoices(id) ON DELETE RESTRICT,
 refund_reference TEXT NOT NULL,
 amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 status TEXT NOT NULL CHECK(status IN('pending','processing','needs-attention','failed','processed')),
 received_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(tenant_id,refund_reference)
);
CREATE INDEX IF NOT EXISTS idx_billing_refunds_invoice ON billing_refunds(tenant_id,invoice_id,status);
CREATE TRIGGER IF NOT EXISTS trg_billing_refund_no_delete BEFORE DELETE ON billing_refunds
 BEGIN SELECT RAISE(ABORT,'Refund history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_billing_refund_amount_immutable BEFORE UPDATE OF tenant_id,invoice_id,refund_reference,amount_minor ON billing_refunds
 BEGIN SELECT RAISE(ABORT,'Refund amount and identity are immutable'); END;
