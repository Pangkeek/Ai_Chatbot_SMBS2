-- PostgreSQL baseline equivalent to SQLite migrations 001 through 003.
-- IDs remain TEXT; TIMESTAMPTZ values serialize as ISO UTC at the API boundary.

CREATE TABLE users (
  id TEXT COLLATE "C" PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100 AND id = trim(id)),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254 AND email = trim(email)),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  password_hash TEXT NOT NULL CHECK (length(password_hash) BETWEEN 1 AND 255),
  created_at TIMESTAMPTZ NOT NULL CHECK (isfinite(created_at))
);

CREATE TABLE shops (
  id TEXT COLLATE "C" PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100 AND id = trim(id)),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  opening_hours TEXT NOT NULL DEFAULT '' CHECK (length(opening_hours) <= 1000),
  persona TEXT NOT NULL DEFAULT '' CHECK (length(persona) <= 5000),
  created_at TIMESTAMPTZ NOT NULL CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL CHECK (isfinite(updated_at))
);

CREATE TABLE shop_memberships (
  shop_id TEXT COLLATE "C" NOT NULL CHECK (length(shop_id) BETWEEN 1 AND 100) REFERENCES shops(id) ON DELETE CASCADE,
  user_id TEXT COLLATE "C" NOT NULL CHECK (length(user_id) BETWEEN 1 AND 100) REFERENCES users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'agent')),
  created_at TIMESTAMPTZ NOT NULL CHECK (isfinite(created_at)),
  PRIMARY KEY (shop_id, user_id)
);

CREATE TABLE sessions (
  token_hash TEXT COLLATE "C" PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id TEXT COLLATE "C" NOT NULL CHECK (length(user_id) BETWEEN 1 AND 100) REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL CHECK (isfinite(expires_at)),
  created_at TIMESTAMPTZ NOT NULL CHECK (isfinite(created_at))
);

CREATE TABLE knowledge_entries (
  id TEXT COLLATE "C" PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100 AND id = trim(id)),
  shop_id TEXT COLLATE "C" NOT NULL CHECK (length(shop_id) BETWEEN 1 AND 100) REFERENCES shops(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('faq', 'product', 'policy', 'general')),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 20000),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_by TEXT COLLATE "C" NOT NULL CHECK (length(created_by) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL CHECK (isfinite(updated_at)),
  FOREIGN KEY (shop_id, created_by) REFERENCES shop_memberships(shop_id, user_id)
);

CREATE TABLE conversations (
  id TEXT COLLATE "C" PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100 AND id = trim(id)),
  shop_id TEXT COLLATE "C" NOT NULL CHECK (length(shop_id) BETWEEN 1 AND 100) REFERENCES shops(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'line')),
  customer_external_id TEXT NOT NULL CHECK (length(trim(customer_external_id)) BETWEEN 1 AND 200),
  customer_name TEXT NOT NULL CHECK (length(trim(customer_name)) BETWEEN 1 AND 100),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  bot_mode TEXT NOT NULL CHECK (bot_mode IN ('active', 'paused', 'human')),
  created_at TIMESTAMPTZ NOT NULL CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL CHECK (isfinite(updated_at)),
  UNIQUE (shop_id, id)
);

CREATE TABLE messages (
  id TEXT COLLATE "C" PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100 AND id = trim(id)),
  shop_id TEXT COLLATE "C" NOT NULL CHECK (length(shop_id) BETWEEN 1 AND 100) REFERENCES shops(id) ON DELETE CASCADE,
  conversation_id TEXT COLLATE "C" NOT NULL CHECK (length(conversation_id) BETWEEN 1 AND 100),
  role TEXT NOT NULL CHECK (role IN ('customer', 'assistant', 'agent', 'system')),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 10000),
  author_user_id TEXT COLLATE "C" CHECK (author_user_id IS NULL OR length(author_user_id) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL CHECK (isfinite(created_at)),
  FOREIGN KEY (shop_id, conversation_id) REFERENCES conversations(shop_id, id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id, author_user_id) REFERENCES shop_memberships(shop_id, user_id),
  CHECK ((role = 'agent' AND author_user_id IS NOT NULL) OR (role != 'agent' AND author_user_id IS NULL))
);

CREATE TABLE line_channels (
  shop_id TEXT COLLATE "C" PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  channel_id TEXT,
  channel_secret TEXT NOT NULL CHECK (length(trim(channel_secret)) BETWEEN 1 AND 100),
  channel_access_token TEXT NOT NULL CHECK (length(trim(channel_access_token)) BETWEEN 1 AND 500),
  destination_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL CHECK (isfinite(updated_at))
);

CREATE TABLE line_events (
  event_id TEXT COLLATE "C" PRIMARY KEY,
  shop_id TEXT COLLATE "C" NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) BETWEEN 1 AND 50),
  reply_token TEXT,
  status TEXT NOT NULL CHECK (status IN ('received', 'processing', 'completed', 'failed', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL CHECK (isfinite(created_at))
);

CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE INDEX memberships_user_idx ON shop_memberships(user_id, shop_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX knowledge_shop_idx ON knowledge_entries(shop_id, created_at, id);
CREATE INDEX conversations_shop_idx ON conversations(shop_id, created_at, id);
CREATE INDEX messages_conversation_idx ON messages(shop_id, conversation_id, created_at, id);
CREATE INDEX line_events_shop_idx ON line_events(shop_id, created_at);
