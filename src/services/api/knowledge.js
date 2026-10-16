import { randomUUID } from 'node:crypto';
import { transaction } from '../../lib/db.js';

import { now, wrap, createDbHelpers } from './common.js';
import { indexKnowledgeEntry } from '../rag.js';

export function createKnowledgeOperations(db, { get, page }) {
  return {
    async listKnowledge({ params, query }) { return page('knowledge_entries', 'shop_id = ?', [params.shopId], query); },
    async createKnowledge({ params, user, body }) {
      return transaction(db, async tx => {
        const id = randomUUID(), time = now();
        await tx.query('INSERT INTO knowledge_entries (id,shop_id,kind,title,content,status,created_by,created_at,updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [id, params.shopId, body.kind, body.title, body.content, body.status, user.id, time, time]);
        await indexKnowledgeEntry(tx, params.shopId, id);
        return wrap(await get('knowledge_entries', params.shopId, id, tx));
      });
    },
    async getKnowledge({ params }) { return wrap(await get('knowledge_entries', params.shopId, params.knowledgeId)); },
    async updateKnowledge({ params, body }) {
      return transaction(db, async tx => {
        await get('knowledge_entries', params.shopId, params.knowledgeId, tx, true);
        const { patch: update } = createDbHelpers(tx);
        await update('knowledge_entries', body, 'shop_id = ? AND id = ?', [params.shopId, params.knowledgeId]);
        await indexKnowledgeEntry(tx, params.shopId, params.knowledgeId);
        return wrap(await get('knowledge_entries', params.shopId, params.knowledgeId, tx));
      });
    },
    async deleteKnowledge({ params }) {
      await get('knowledge_entries', params.shopId, params.knowledgeId);
      await db.query('DELETE FROM knowledge_entries WHERE shop_id = $1 AND id = $2', [params.shopId, params.knowledgeId]);
    },
  };
}
