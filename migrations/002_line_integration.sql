CREATE TABLE line_channels (
  shop_id TEXT PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  channel_id TEXT,
  channel_secret TEXT NOT NULL CHECK (length(trim(channel_secret)) BETWEEN 1 AND 100),
  channel_access_token TEXT NOT NULL CHECK (length(trim(channel_access_token)) BETWEEN 1 AND 500),
  destination_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE line_events (
  event_id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) BETWEEN 1 AND 50),
  reply_token TEXT,
  status TEXT NOT NULL CHECK (status IN ('received', 'processing', 'completed', 'failed', 'ignored')),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX line_events_shop_idx ON line_events(shop_id, created_at);
