import { createLineWorker } from './worker.js';
import { createDbHelpers } from './api/common.js';
import { createAuthShopsOperations } from './api/authShops.js';
import { createKnowledgeOperations } from './api/knowledge.js';
import { createConversationsOperations } from './api/conversations.js';
import { createLineChannelOperations } from './api/lineChannel.js';

export { publicUser } from './api/common.js';

export function createService(db, options = {}) {
  const worker = options.worker || createLineWorker(db, options.workerOptions);
  const helpers = createDbHelpers(db);

  // operationId ใน contracts.js ใช้ชื่อเดียวกับเมธอดที่รวมตรงนี้
  return {
    ...createAuthShopsOperations(db, helpers),
    ...createKnowledgeOperations(db, helpers),
    ...createConversationsOperations(db, helpers),
    ...createLineChannelOperations(db, worker, options),
    worker,
  };
}
