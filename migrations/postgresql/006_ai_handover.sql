ALTER TABLE conversations ADD COLUMN handover_reason TEXT
  CHECK (handover_reason IN ('AI_UNAVAILABLE', 'AI_SAFETY_REFUSAL'));
-- Opaque ownership token, also used by simulator events. No FK: job retention must not undo handover.
ALTER TABLE conversations ADD COLUMN handover_job_id TEXT;
ALTER TABLE conversations ADD CONSTRAINT handover_state_consistent CHECK (
  (handover_reason IS NULL AND handover_job_id IS NULL) OR
  (handover_reason IS NOT NULL AND handover_job_id IS NOT NULL AND bot_mode = 'human')
);

-- Any explicit admin change invalidates an old notification, even human -> human or a close/reopen.
CREATE FUNCTION clear_ai_handover() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.handover_reason := NULL;
  NEW.handover_job_id := NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER clear_ai_handover_on_mode BEFORE UPDATE OF bot_mode, status ON conversations
  FOR EACH ROW WHEN (NEW.handover_job_id IS NOT DISTINCT FROM OLD.handover_job_id)
  EXECUTE FUNCTION clear_ai_handover();
