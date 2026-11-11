-- A phone is an optional sign-in alias for an existing verified-email account.
-- It does NOT verify phone possession or entitle the account to receipts by phone.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_contact_phone ON users(contact_phone) WHERE contact_phone IS NOT NULL;
