-- Customer contact collection and optional transparent signature (additive).
-- Phone numbers are contact references, not standalone identity proof.
ALTER TABLE documents ADD COLUMN recipient_phone TEXT;
ALTER TABLE tenants ADD COLUMN signature_url TEXT;
ALTER TABLE users ADD COLUMN contact_phone TEXT;
ALTER TABLE tenant_designs ADD COLUMN show_signature INTEGER NOT NULL DEFAULT 0 CHECK(show_signature IN (0,1));
CREATE INDEX IF NOT EXISTS idx_documents_contact_phone ON documents(recipient_phone) WHERE recipient_phone IS NOT NULL;
-- Do not expose phone matches through public queries or customer inbox without a private code.
