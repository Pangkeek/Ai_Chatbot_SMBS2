import { answerQuestion } from './rag.js';
import { getRuntimeGenerator } from './ai/config.js';
import { formatChatbotReply } from './chatbotReply.js';
import { buildConversationPrompt, conversationFallback, hasBusinessQuestion,
  loadConversationHistory, validateConversation } from './ai/conversation.js';

export async function prepareReply(db, { shop, conversation, messageText, currentMessageId }, options = {}) {
  if (options.generateReply) return { text: await options.generateReply({ shop, conversation, messageText }), sources: [], method: 'custom' };
  options.signal?.throwIfAborted();
  const generator = Object.hasOwn(options, 'generator') ? options.generator : getRuntimeGenerator();
  const deadlineAt = options.deadlineAt ?? Date.now() + 28000;
  let query = messageText;
  let resolved = false;
  const history = generator?.analyzeConversation ? await loadConversationHistory(db, { shopId: shop.id,
    conversationId: conversation?.id, currentMessageId }) : [];
  // Clear first-turn factual questions can go straight to retrieval. Later turns may refer to an earlier product.
  const factual = hasBusinessQuestion(messageText);
  if (history.length || !factual || /^(?:แล้ว|ส่วน|ถ้า|อันนั้น|ตัวนั้น|and\b|what about\b)/i.test(messageText.trim())) {
    if (generator?.analyzeConversation) {
      try {
        const result = validateConversation(await generator.analyzeConversation({ shopId: shop.id,
          prompt: buildConversationPrompt({ shop, messageText, history }), signal: options.signal,
          deadlineAt: Math.min(deadlineAt, Date.now() + 6000), jobId: options.jobId }));
        options.signal?.throwIfAborted();
        if (result?.intent === 'business') { query = result.resolvedQuestion; resolved = true; }
        else if (result && !factual) return { text: result.replyText, sources: [], method: result.intent };
      } catch {
        options.signal?.throwIfAborted();
      }
    }
    if (!resolved && !factual) {
      const fallback = conversationFallback(messageText, shop.persona);
      if (fallback) return fallback;
    }
  }
  const answer = await answerQuestion(db, { shopId: shop.id, query, generator,
    signal: options.signal, deadlineAt, jobId: options.jobId });
  return { ...answer, text: formatChatbotReply(answer, shop.persona) };
}

export async function saveReplySources(tx, shopId, messageId, sources) {
  for (const source of sources) await tx.query(`INSERT INTO message_sources
    (shop_id,message_id,knowledge_entry_id,chunk_id,source_excerpt) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT DO NOTHING`, [shopId,messageId,source.knowledge_entry_id,source.chunk_id,source.content]);
}
