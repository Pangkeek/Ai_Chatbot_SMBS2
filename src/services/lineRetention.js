import { transaction } from '../lib/db.js';

export async function cleanupLineHistory(db) {
  return transaction(db, async tx => {
    const jobs = await tx.query(`UPDATE line_jobs SET payload='{}'::jsonb,reply_text=NULL,reply_sources='[]'::jsonb
      WHERE status IN ('completed','failed','unknown','ignored')
      AND updated_at<clock_timestamp()-interval '30 days'
      AND (payload<>'{}'::jsonb OR reply_text IS NOT NULL OR reply_sources<>'[]'::jsonb)`);
    const events = await tx.query(`UPDATE line_events e SET reply_token=NULL
      WHERE reply_token IS NOT NULL AND created_at<clock_timestamp()-interval '30 days'
      AND status IN ('completed','failed','ignored')
      AND NOT EXISTS (SELECT 1 FROM line_jobs j WHERE j.shop_id=e.shop_id AND j.event_id=e.event_id
        AND (j.status IN ('pending','processing') OR j.updated_at>=clock_timestamp()-interval '30 days'))`);
    return { jobs: jobs.rowCount, events: events.rowCount };
  });
}
