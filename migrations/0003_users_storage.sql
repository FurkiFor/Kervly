-- v0.3: accounts (multi-user) and per-brand GitHub storage
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin','user')),
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified','pending','active','disabled')),
  totp_enc TEXT,
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

-- One-time email links (verification, password reset). Only hashes are stored.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens (user_id, purpose);

-- Brand ownership (NULL = owned by the superadmin, for brands created before v0.3)
ALTER TABLE brands ADD COLUMN owner_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_brands_owner ON brands (owner_id);

-- Brand storage: a GitHub repository folder that holds the brand's videos
ALTER TABLE brands ADD COLUMN storage_repo TEXT;
ALTER TABLE brands ADD COLUMN storage_branch TEXT;
ALTER TABLE brands ADD COLUMN storage_path TEXT;
ALTER TABLE brands ADD COLUMN storage_token_enc TEXT;
ALTER TABLE brands ADD COLUMN storage_private INTEGER NOT NULL DEFAULT 0;

-- Who an audit entry belongs to (decides who may read it)
ALTER TABLE audit_log ADD COLUMN user_id TEXT;
ALTER TABLE audit_log ADD COLUMN brand_id TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_brand ON audit_log (brand_id);
