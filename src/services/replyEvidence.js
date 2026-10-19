import { answerQuestion } from './rag.js';
import { getConfiguredRagGenerator } from './aiGateway.js';
import { formatChatbotReply } from './chatbotReply.js';

export async function prepareReply(db, { shop, conversation, messageText }, options) {
  if (options.generateReply) return { text: await options.generateReply({ shop, conversation, messageText }), sources: [], method: 'custom' };
  const answer = await answerQuestion(db, { shopId: shop.id, query: messageText,
    generator: options.generator || getConfiguredRagGenerator() });
  return { ...answer, text: formatChatbotReply(answer, shop.persona) };
}

export async function saveReplySources(tx, shopId, messageId, sources) {
  for (const source of sources) await tx.query(`INSERT INTO message_sources
    (shop_id,message_id,knowledge_entry_id,chunk_id,source_excerpt) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT DO NOTHING`, [shopId,messageId,source.knowledge_entry_id,source.chunk_id,source.content]);
}
