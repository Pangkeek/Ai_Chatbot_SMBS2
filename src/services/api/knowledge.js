import { randomUUID } from 'node:crypto';
import { transaction } from '../../lib/db.js';
import { indexKnowledgeEntry } from '../rag.js';
import { now, wrap } from './common.js';

// รวมคำสั่ง API ที่เกี่ยวกับ knowledge ไว้ในไฟล์เดียว
export function createKnowledgeOperations(db, { get, page, patch }) {
  return {
    listKnowledge({ params, query }) { return page('knowledge_entries', 'shop_id = ?', [params.shopId], query); },
    createKnowledge({ params, user, body }) {
      return transaction(db, () => {
        const id = randomUUID(), time = now();
        db.prepare('INSERT INTO knowledge_entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, params.shopId, body.kind, body.title, body.content, body.status, user.id, time, time);
        indexKnowledgeEntry(db, params.shopId, id);
        return wrap(get('knowledge_entries', params.shopId, id));
      });
    },
    getKnowledge({ params }) { return wrap(get('knowledge_entries', params.shopId, params.knowledgeId)); },
    updateKnowledge({ params, body }) {
      return transaction(db, () => {
        get('knowledge_entries', params.shopId, params.knowledgeId);
        patch('knowledge_entries', body, 'shop_id = ? AND id = ?', [params.shopId, params.knowledgeId]);
        indexKnowledgeEntry(db, params.shopId, params.knowledgeId);
        return this.getKnowledge({ params });
      });
    },
    deleteKnowledge({ params }) {
      return transaction(db, () => {
        get('knowledge_entries', params.shopId, params.knowledgeId);
        db.prepare('DELETE FROM knowledge_entries WHERE shop_id = ? AND id = ?').run(params.shopId, params.knowledgeId);
      });
    },
  };
}
