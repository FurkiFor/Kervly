-- v0.4: one GitHub storage per account. Every brand gets its own folder in it.
ALTER TABLE users ADD COLUMN storage_repo TEXT;
ALTER TABLE users ADD COLUMN storage_branch TEXT;
ALTER TABLE users ADD COLUMN storage_path TEXT;
ALTER TABLE users ADD COLUMN storage_token_enc TEXT;
ALTER TABLE users ADD COLUMN storage_private INTEGER NOT NULL DEFAULT 0;
-- 1 = the brand's storage comes from the account (updated when the account storage changes)
ALTER TABLE brands ADD COLUMN storage_inherited INTEGER NOT NULL DEFAULT 0;
