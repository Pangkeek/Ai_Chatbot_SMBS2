-- Queue storage only. The consumer and delivery/recovery policy are implemented in phase F.
ALTER TABLE line_events ADD CONSTRAINT line_events_shop_event_unique UNIQUE (shop_id, event_id);
ALTER TABLE messages ADD CONSTRAINT messages_shop_conversation_id_unique UNIQUE (shop_id, conversation_id, id);

CREATE TABLE line_jobs (
  job_id TEXT COLLATE "C" PRIMARY KEY CHECK (length(job_id) BETWEEN 1 AND 100 AND job_id = trim(job_id)),
  shop_id TEXT COLLATE "C" NOT NULL,
  event_id TEXT COLLATE "C" NOT NULL,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'unknown', 'ignored')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(available_at)),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(received_at)),
  locked_at TIMESTAMPTZ CHECK (isfinite(locked_at)),
  lease_until TIMESTAMPTZ CHECK (isfinite(lease_until)),
  locked_by TEXT CHECK (length(trim(locked_by)) BETWEEN 1 AND 200),
  delivery_state TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_state IN ('pending', 'sending', 'sent', 'unknown')),
  conversation_id TEXT COLLATE "C",
  customer_message_id TEXT COLLATE "C",
  reply_message_id TEXT COLLATE "C",
  reply_text TEXT CHECK (length(trim(reply_text)) BETWEEN 1 AND 10000),
  last_error_code TEXT CHECK (length(trim(last_error_code)) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(updated_at)),
  UNIQUE (shop_id, event_id),
  FOREIGN KEY (shop_id, event_id) REFERENCES line_events(shop_id, event_id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id, conversation_id) REFERENCES conversations(shop_id, id),
  FOREIGN KEY (shop_id, conversation_id, customer_message_id) REFERENCES messages(shop_id, conversation_id, id),
  FOREIGN KEY (shop_id, conversation_id, reply_message_id) REFERENCES messages(shop_id, conversation_id, id),
  CHECK ((customer_message_id IS NULL AND reply_message_id IS NULL) OR conversation_id IS NOT NULL),
  CHECK ((locked_at IS NULL AND lease_until IS NULL AND locked_by IS NULL)
    OR (locked_at IS NOT NULL AND lease_until IS NOT NULL AND locked_by IS NOT NULL AND lease_until > locked_at))
);

CREATE INDEX line_jobs_available_idx ON line_jobs(status, available_at, job_id);
CREATE INDEX line_jobs_expired_lease_idx ON line_jobs(lease_until, job_id) WHERE status = 'processing';
