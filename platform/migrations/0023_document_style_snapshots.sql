-- Persist a document's appearance when first saved; no changes to historical documents.
ALTER TABLE documents ADD COLUMN design_snapshot_json TEXT;
ALTER TABLE documents ADD COLUMN design_profile_id TEXT;
CREATE INDEX IF NOT EXISTS idx_document_design_profile ON documents(tenant_id,design_profile_id);
CREATE TRIGGER IF NOT EXISTS trg_design_snapshot_immutable BEFORE UPDATE OF design_snapshot_json,design_profile_id ON documents
 WHEN OLD.status IN ('issued','part_paid','paid','voided')
 BEGIN SELECT RAISE(ABORT,'Issued document appearance cannot be silently changed'); END;
