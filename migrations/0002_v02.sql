-- v0.2: scheduler heartbeat and per-brand default posting times
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
ALTER TABLE brands ADD COLUMN default_times TEXT NOT NULL DEFAULT '[]';
