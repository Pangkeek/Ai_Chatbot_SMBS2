import { createLineWorker } from './worker.js';
import { createDbHelpers } from './api/common.js';
import { createAuthShopsOperations } from './api/authShops.js';
import { createKnowledgeOperations } from './api/knowledge.js';
import { createConversationsOperations } from './api/conversations.js';
import { createLineChannelOperations } from './api/lineChannel.js';
import { createAiPreviewOperations } from './api/aiPreview.js';
import { createStatisticsOperations } from './api/statistics.js';
import { createAgentRepliesOperations } from './api/agentReplies.js';

export { publicUser } from './api/common.js';
export function createService(db, options = {}) {
  const worker = options.worker || createLineWorker(db, options.workerOptions);
  const helpers = createDbHelpers(db);
  return {
    ...createAuthShopsOperations(db, helpers),
    ...createKnowledgeOperations(db, helpers),
    ...createConversationsOperations(db, helpers),
    ...createAgentRepliesOperations(db, helpers, options),
    ...createLineChannelOperations(db, worker, options),
    ...createAiPreviewOperations(db),
    ...createStatisticsOperations(db),
    worker,
  };
}
