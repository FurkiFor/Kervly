-- Markalar: her markanın kendi platform hesapları, video izin listesi ve günlük sınırı vardır
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 2 AND 32),
  name TEXT NOT NULL,
  media_prefixes TEXT NOT NULL DEFAULT '[]',
  max_posts_per_day INTEGER NOT NULL DEFAULT 5,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Gönderi kuyruğu
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  platform TEXT NOT NULL CHECK (platform IN ('youtube','instagram','tiktok')),
  media_url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  options TEXT NOT NULL DEFAULT '{}',
  publish_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','publishing','processing','published','error','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  remote_ref TEXT,
  external_id TEXT,
  result_url TEXT,
  error TEXT,
  source TEXT NOT NULL DEFAULT 'ui',
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_due ON posts (status, publish_at);
CREATE INDEX IF NOT EXISTS idx_posts_brand ON posts (brand_id, platform, publish_at);
-- Aynı video aynı markada, aynı platformda aynı saate iki kez planlanamaz (iptal edilenler hariç)
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_unique ON posts (brand_id, platform, media_url, publish_at) WHERE status != 'cancelled';

-- Platform bağlantıları (marka başına; tokenlar AES-GCM ile şifreli)
CREATE TABLE IF NOT EXISTS connections (
  brand_id TEXT NOT NULL REFERENCES brands(id),
  platform TEXT NOT NULL CHECK (platform IN ('youtube','instagram','tiktok')),
  account_id TEXT,
  account_name TEXT,
  enc_tokens TEXT NOT NULL,
  access_expires_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (brand_id, platform)
);

-- Denetim kaydı
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (ts);
