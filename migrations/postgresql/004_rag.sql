CREATE UNIQUE INDEX knowledge_shop_id_unique ON knowledge_entries(shop_id, id);
CREATE UNIQUE INDEX messages_shop_id_unique ON messages(shop_id, id);

CREATE TABLE knowledge_chunks (
  id TEXT COLLATE "C" PRIMARY KEY,
  shop_id TEXT COLLATE "C" NOT NULL,
  knowledge_entry_id TEXT COLLATE "C" NOT NULL,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 1200),
  embedding_json TEXT NOT NULL,
  embedding_version TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL CHECK (isfinite(source_updated_at)),
  UNIQUE (shop_id, knowledge_entry_id, chunk_index),
  FOREIGN KEY (shop_id, knowledge_entry_id) REFERENCES knowledge_entries(shop_id, id) ON DELETE CASCADE
);
CREATE INDEX knowledge_chunks_shop_idx ON knowledge_chunks(shop_id, knowledge_entry_id);

CREATE TABLE message_sources (
  shop_id TEXT COLLATE "C" NOT NULL,
  message_id TEXT COLLATE "C" NOT NULL,
  knowledge_entry_id TEXT COLLATE "C" NOT NULL,
  chunk_id TEXT COLLATE "C" NOT NULL,
  source_excerpt TEXT NOT NULL,
  PRIMARY KEY (shop_id, message_id, chunk_id),
  FOREIGN KEY (shop_id, message_id) REFERENCES messages(shop_id, id) ON DELETE CASCADE
);
CREATE INDEX message_sources_message_idx ON message_sources(shop_id, message_id);

-- Persist evidence before HTTP delivery so restart recovery preserves the audit.
ALTER TABLE line_jobs ADD COLUMN reply_sources JSONB NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(reply_sources) = 'array');
ALTER TABLE line_jobs ADD COLUMN reply_method TEXT;
