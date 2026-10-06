-- A shop deletion cascades through conversations/messages and events/jobs.
-- Check checkpoint references at transaction end, after both cascade paths finish.
-- A standalone deletion of a referenced checkpoint still fails until its job is removed.
ALTER TABLE line_jobs ALTER CONSTRAINT line_jobs_shop_id_conversation_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE line_jobs ALTER CONSTRAINT line_jobs_shop_id_conversation_id_customer_message_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE line_jobs ALTER CONSTRAINT line_jobs_shop_id_conversation_id_reply_message_id_fkey DEFERRABLE INITIALLY DEFERRED;
