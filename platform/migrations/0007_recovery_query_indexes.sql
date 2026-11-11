-- Optimize verified customer lookups for large multi-tenant histories.
-- Emails are indexed at issue time in 0006. Index exact document ID for
-- private detail pages without scanning all tenant rows.
CREATE INDEX IF NOT EXISTS idx_documents_customer_exact_id ON documents(id);
