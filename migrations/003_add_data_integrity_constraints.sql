PRAGMA defer_foreign_keys = ON;

CREATE TABLE new_users (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100 AND id = trim(id)),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(email) BETWEEN 3 AND 254 AND email = trim(email)),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  password_hash TEXT NOT NULL CHECK (length(password_hash) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at)
) STRICT;

CREATE TABLE new_shops (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100 AND id = trim(id)),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  opening_hours TEXT NOT NULL DEFAULT '' CHECK (length(opening_hours) <= 1000),
  persona TEXT NOT NULL DEFAULT '' CHECK (length(persona) <= 5000),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at),
  updated_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) = updated_at)
) STRICT;

CREATE TABLE new_shop_memberships (
  shop_id TEXT NOT NULL CHECK (length(shop_id) BETWEEN 1 AND 100) REFERENCES new_shops(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL CHECK (length(user_id) BETWEEN 1 AND 100) REFERENCES new_users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'agent')),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at),
  PRIMARY KEY (shop_id, user_id)
) STRICT;

CREATE TABLE new_sessions (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  user_id TEXT NOT NULL CHECK (length(user_id) BETWEEN 1 AND 100) REFERENCES new_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) = expires_at),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at)
) STRICT;

CREATE TABLE new_knowledge_entries (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100 AND id = trim(id)),
  shop_id TEXT NOT NULL CHECK (length(shop_id) BETWEEN 1 AND 100) REFERENCES new_shops(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('faq', 'product', 'policy', 'general')),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 20000),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_by TEXT NOT NULL CHECK (length(created_by) BETWEEN 1 AND 100),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at),
  updated_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) = updated_at),
  FOREIGN KEY (shop_id, created_by) REFERENCES new_shop_memberships(shop_id, user_id)
) STRICT;

CREATE TABLE new_conversations (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100 AND id = trim(id)),
  shop_id TEXT NOT NULL CHECK (length(shop_id) BETWEEN 1 AND 100) REFERENCES new_shops(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'line')),
  customer_external_id TEXT NOT NULL CHECK (length(trim(customer_external_id)) BETWEEN 1 AND 200),
  customer_name TEXT NOT NULL CHECK (length(trim(customer_name)) BETWEEN 1 AND 100),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  bot_mode TEXT NOT NULL CHECK (bot_mode IN ('active', 'paused', 'human')),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at),
  updated_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) = updated_at),
  UNIQUE (shop_id, id)
) STRICT;

CREATE TABLE new_messages (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100 AND id = trim(id)),
  shop_id TEXT NOT NULL CHECK (length(shop_id) BETWEEN 1 AND 100) REFERENCES new_shops(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL CHECK (length(conversation_id) BETWEEN 1 AND 100),
  role TEXT NOT NULL CHECK (role IN ('customer', 'assistant', 'agent', 'system')),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 10000),
  author_user_id TEXT CHECK (author_user_id IS NULL OR length(author_user_id) BETWEEN 1 AND 100),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at),
  FOREIGN KEY (shop_id, conversation_id) REFERENCES new_conversations(shop_id, id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id, author_user_id) REFERENCES new_shop_memberships(shop_id, user_id),
  CHECK ((role = 'agent' AND author_user_id IS NOT NULL) OR (role != 'agent' AND author_user_id IS NULL))
) STRICT;

CREATE TABLE new_line_channels (
  shop_id TEXT PRIMARY KEY REFERENCES new_shops(id) ON DELETE CASCADE,
  channel_id TEXT,
  channel_secret TEXT NOT NULL CHECK (length(trim(channel_secret)) BETWEEN 1 AND 100),
  channel_access_token TEXT NOT NULL CHECK (length(trim(channel_access_token)) BETWEEN 1 AND 500),
  destination_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE new_line_events (
  event_id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES new_shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) BETWEEN 1 AND 50),
  reply_token TEXT,
  status TEXT NOT NULL CHECK (status IN ('received', 'processing', 'completed', 'failed', 'ignored')),
  created_at TEXT NOT NULL
) STRICT;

INSERT INTO new_users SELECT * FROM users;
INSERT INTO new_shops SELECT * FROM shops;
INSERT INTO new_shop_memberships SELECT * FROM shop_memberships;
INSERT INTO new_sessions SELECT * FROM sessions;
INSERT INTO new_knowledge_entries SELECT * FROM knowledge_entries;
INSERT INTO new_conversations SELECT * FROM conversations;
INSERT INTO new_messages SELECT * FROM messages;
INSERT INTO new_line_channels SELECT * FROM line_channels;
INSERT INTO new_line_events SELECT * FROM line_events;

DROP TABLE line_events;
DROP TABLE line_channels;
DROP TABLE messages;
DROP TABLE conversations;
DROP TABLE knowledge_entries;
DROP TABLE sessions;
DROP TABLE shop_memberships;
DROP TABLE shops;
DROP TABLE users;

ALTER TABLE new_users RENAME TO users;
ALTER TABLE new_shops RENAME TO shops;
ALTER TABLE new_shop_memberships RENAME TO shop_memberships;
ALTER TABLE new_sessions RENAME TO sessions;
ALTER TABLE new_knowledge_entries RENAME TO knowledge_entries;
ALTER TABLE new_conversations RENAME TO conversations;
ALTER TABLE new_messages RENAME TO messages;
ALTER TABLE new_line_channels RENAME TO line_channels;
ALTER TABLE new_line_events RENAME TO line_events;

CREATE INDEX memberships_user_idx ON shop_memberships(user_id, shop_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX knowledge_shop_idx ON knowledge_entries(shop_id, created_at, id);
CREATE INDEX conversations_shop_idx ON conversations(shop_id, created_at, id);
CREATE INDEX messages_conversation_idx ON messages(shop_id, conversation_id, created_at, id);
CREATE INDEX line_events_shop_idx ON line_events(shop_id, created_at);
