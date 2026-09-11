CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '',
  opening_hours TEXT NOT NULL DEFAULT '',
  persona TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE shop_memberships (
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'agent')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (shop_id, user_id)
) STRICT;
CREATE INDEX memberships_user_idx ON shop_memberships(user_id, shop_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE knowledge_entries (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('faq', 'product', 'policy', 'general')),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 20000),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (shop_id, created_by) REFERENCES shop_memberships(shop_id, user_id)
) STRICT;
CREATE INDEX knowledge_shop_idx ON knowledge_entries(shop_id, created_at, id);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'line')),
  customer_external_id TEXT NOT NULL CHECK (length(trim(customer_external_id)) BETWEEN 1 AND 200),
  customer_name TEXT NOT NULL CHECK (length(trim(customer_name)) BETWEEN 1 AND 100),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  bot_mode TEXT NOT NULL CHECK (bot_mode IN ('active', 'paused', 'human')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (shop_id, id)
) STRICT;
CREATE INDEX conversations_shop_idx ON conversations(shop_id, created_at, id);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'assistant', 'agent', 'system')),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 10000),
  author_user_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id, conversation_id) REFERENCES conversations(shop_id, id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id, author_user_id) REFERENCES shop_memberships(shop_id, user_id),
  CHECK ((role = 'agent' AND author_user_id IS NOT NULL) OR (role != 'agent' AND author_user_id IS NULL))
) STRICT;
CREATE INDEX messages_conversation_idx ON messages(shop_id, conversation_id, created_at, id);
