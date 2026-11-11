-- Verified-email customer receipt inbox (customer has NO business membership).
-- Snapshot email at issuance. Do not identify customers by name alone.
ALTER TABLE documents ADD COLUMN recipient_email TEXT COLLATE NOCASE;
CREATE INDEX IF NOT EXISTS idx_documents_receipt_email
ON documents(recipient_email,issued_on DESC) WHERE recipient_email IS NOT NULL;

-- Optional recovery via an unguessable code printed on issued documents.
-- The code is held by the purchaser; only its SHA-256 digest is stored.
CREATE TABLE IF NOT EXISTS customer_receipt_claims (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 tenant_id TEXT NOT NULL,
 document_id TEXT NOT NULL,
 verified_at TEXT NOT NULL DEFAULT (datetime('now')),
 proof TEXT NOT NULL CHECK(proof IN ('receipt_code')),
 PRIMARY KEY(user_id,tenant_id,document_id),
 FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_receipt_claims_user ON customer_receipt_claims(user_id,verified_at DESC);

-- Historic documents with no email stay private. They must be linked through
-- a vendor-issued recovery code; never infer ownership from a matching name.
