CREATE UNIQUE INDEX knowledge_shop_id_unique ON knowledge_entries(shop_id, id);
CREATE UNIQUE INDEX messages_shop_id_unique ON messages(shop_id, id);

CREATE TABLE knowledge_chunks (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  knowledge_entry_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 1200),
  embedding_json TEXT NOT NULL,
  embedding_version TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  UNIQUE (shop_id, knowledge_entry_id, chunk_index),
  FOREIGN KEY (shop_id, knowledge_entry_id) REFERENCES knowledge_entries(shop_id, id) ON DELETE CASCADE
) STRICT;
CREATE INDEX knowledge_chunks_shop_idx ON knowledge_chunks(shop_id, knowledge_entry_id);

CREATE TABLE message_sources (
  shop_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  knowledge_entry_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  source_excerpt TEXT NOT NULL,
  PRIMARY KEY (shop_id, message_id, chunk_id),
  FOREIGN KEY (shop_id, message_id) REFERENCES messages(shop_id, id) ON DELETE CASCADE
) STRICT;
CREATE INDEX message_sources_message_idx ON message_sources(shop_id, message_id);
