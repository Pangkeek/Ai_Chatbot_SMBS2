CREATE TABLE agent_deliveries (
  id TEXT COLLATE "C" PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100 AND id=trim(id)),
  shop_id TEXT COLLATE "C" NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  conversation_id TEXT COLLATE "C" NOT NULL,
  request_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 5000),
  author_user_id TEXT COLLATE "C" NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending','sent','failed','unknown')),
  message_id TEXT COLLATE "C",
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(updated_at)),
  UNIQUE (shop_id,conversation_id,request_id),
  FOREIGN KEY (shop_id,conversation_id,message_id) REFERENCES messages(shop_id,conversation_id,id),
  FOREIGN KEY (shop_id,conversation_id) REFERENCES conversations(shop_id,id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id,author_user_id) REFERENCES shop_memberships(shop_id,user_id)
);
CREATE INDEX agent_deliveries_room_idx ON agent_deliveries(shop_id,conversation_id,created_at,id);

ALTER TABLE conversations ADD COLUMN bot_revision INTEGER NOT NULL DEFAULT 0 CHECK (bot_revision>=0);
ALTER TABLE conversations ADD COLUMN bot_changed_at TIMESTAMPTZ CHECK (bot_changed_at IS NULL OR isfinite(bot_changed_at));
ALTER TABLE line_jobs ADD COLUMN bot_revision INTEGER;

-- เปลี่ยนสถานะแล้วเปลี่ยนกลับก็ยังยกเลิกคำตอบ AI รุ่นก่อนหน้า
CREATE FUNCTION bump_bot_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.bot_mode IS DISTINCT FROM OLD.bot_mode OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.bot_revision := OLD.bot_revision + 1;
    NEW.bot_changed_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER conversations_bot_revision BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION bump_bot_revision();
