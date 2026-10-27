import { createHash } from 'node:crypto';
import { transaction } from '../lib/db.js';
import { buildBusinessEvidence, matchesBusinessQuestion } from './businessEvidence.js';
import { buildAnswerPrompt } from './answerPrompt.js';
import { validateGeneratedAnswer } from './ai/answerValidation.js';
import { handoverAnswer } from './ai/handover.js';

export const EMBEDDING_VERSION = 'local-chargram-v1-256';
export const UNKNOWN_ANSWER = 'ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่';
const dimensions = 256;
const segmenter = new Intl.Segmenter('th', { granularity: 'word' });

function normalize(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('th')
    .replace(/[\u200b-\u200d]/g, '').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
}

function canonicalQuestion(value) {
  return normalize(value)
    .replace(/(ครับ|ค่ะ|คะ|หน่อย|หรือไม่|ไหม|มั้ย)/g, '')
    .replace(/ร้านเปิดกี่โมง|เปิดกี่โมง|เวลาเปิดปิด|เวลาทำการ/g, 'เวลาเปิดร้าน')
    // ภาษาไทยอาจเว้นวรรคทุกคำหรือพิมพ์ติดกัน จึงเทียบ FAQ โดยไม่ใช้ช่องว่าง
    .replace(/\s+/g, '');
}

function terms(value) {
  // NFKC แยกสระอำจนตัด "สำหรับ" เป็น "รับ" ทำให้จับคำถามรับโอนผิดเรื่อง
  // คืนรูปเฉพาะตอนตัดคำ ไม่เปลี่ยน embedding เดิมที่เก็บในฐานข้อมูล
  const wordText = normalize(value).replace(/\u0e4d\u0e32/g, '\u0e33');
  const words = [...segmenter.segment(wordText)]
    .filter(part => part.isWordLike).map(part => part.segment.trim())
    .filter(word => word.length > 1 && !['ร้าน', 'อะไร', 'บ้าง', 'หรือ', 'ครับ', 'ค่ะ', 'ไหม', 'หน่อย'].includes(word));
  return new Set(words);
}

export function embed(value) {
  const vector = Array(dimensions).fill(0);
  const compact = normalize(value).replaceAll(' ', '');
  for (let size = 2; size <= 3; size++) {
    for (let i = 0; i <= compact.length - size; i++) {
      const gram = compact.slice(i, i + size);
      const hash = createHash('sha256').update(gram).digest();
      vector[hash.readUInt16BE(0) % dimensions] += 1;
    }
  }
  const magnitude = Math.hypot(...vector);
  return magnitude ? vector.map(n => n / magnitude) : vector;
}

function splitContent(content) {
  const paragraphs = content.trim().split(/(?<=[.!?。\n])|\n+/u).map(s => s.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const paragraph of paragraphs) {
    for (let offset = 0; offset < paragraph.length; offset += 800) {
      const part = paragraph.slice(offset, offset + 800);
      if (current && current.length + part.length + 1 > 800) {
        chunks.push(current);
        current = '';
      }
      current = current ? `${current} ${part}` : part;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function indexKnowledgeEntry(db, shopId, knowledgeEntryId) {
  const entry = (await db.query('SELECT * FROM knowledge_entries WHERE shop_id=$1 AND id=$2 FOR UPDATE', [shopId, knowledgeEntryId])).rows[0];
  await db.query('DELETE FROM knowledge_chunks WHERE shop_id=$1 AND knowledge_entry_id=$2', [shopId, knowledgeEntryId]);
  if (!entry || entry.status !== 'published') return 0;
  const chunks = splitContent(entry.content);
  for (const [index, content] of chunks.entries()) {
    await db.query(`INSERT INTO knowledge_chunks
      (id,shop_id,knowledge_entry_id,chunk_index,content,embedding_json,embedding_version,source_updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [`${knowledgeEntryId}:${index}`,shopId,knowledgeEntryId,index,content,
      JSON.stringify(embed(`${entry.title} ${content}`)),EMBEDDING_VERSION,entry.updated_at]);
  }
  return chunks.length;
}

export async function rebuildKnowledgeIndex(db) {
  return transaction(db, async tx => {
    await tx.query('LOCK TABLE knowledge_entries IN SHARE ROW EXCLUSIVE MODE');
    await tx.query('DELETE FROM knowledge_chunks');
    const entries = (await tx.query("SELECT shop_id,id FROM knowledge_entries WHERE status='published' ORDER BY shop_id,id")).rows;
    let chunks = 0;
    for (const entry of entries) chunks += await indexKnowledgeEntry(tx,entry.shop_id,entry.id);
    return { entries: entries.length, chunks };
  });
}

function cosine(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

export async function retrieve(db, { shopId, query, limit = 4, shop }) {
  if (!shopId || !normalize(query)) return [];
  const business = shop || (await db.query('SELECT * FROM shops WHERE id=$1', [shopId])).rows[0];
  const searchQuery = /ส่ง|เดลิเวอรี่|delivery/i.test(query) ? `${query} การจัดส่ง` : query;
  const knowledgeRows = (await db.query(`SELECT c.id AS chunk_id, c.knowledge_entry_id, c.content, c.embedding_json,
      e.kind, e.title, e.content AS full_content
    FROM knowledge_chunks c JOIN knowledge_entries e
      ON e.shop_id = c.shop_id AND e.id = c.knowledge_entry_id
    WHERE c.shop_id = $1 AND e.status = 'published'
      AND c.embedding_version = $2 AND c.source_updated_at = e.updated_at`, [shopId, EMBEDDING_VERSION])).rows;
  const rows = [...knowledgeRows, ...buildBusinessEvidence(business)];
  const queryVector = embed(searchQuery);
  const queryTerms = terms(searchQuery);
  const ranked = rows.map(row => {
    const titleTerms = terms(row.title);
    const bodyTerms = terms(row.content);
    const titleHits = [...queryTerms].filter(term => titleTerms.has(term)).length;
    const bodyHits = [...queryTerms].filter(term => bodyTerms.has(term)).length;
    const overlap = queryTerms.size ? Math.min(1, (titleHits * 1.5 + bodyHits * 0.5) / queryTerms.size) : 0;
    const similarity = cosine(queryVector, row.embedding_json ? JSON.parse(row.embedding_json) : embed(`${row.title} ${row.content}`));
    const exactFaq = row.kind === 'faq' && canonicalQuestion(query) === canonicalQuestion(row.title);
    const businessMatch = row.source_type === 'business' && matchesBusinessQuestion(query, row.source_field);
    const score = exactFaq ? 1 : businessMatch ? 0.9 : 0.6 * similarity + 0.4 * overlap;
    // ข้อมูลร้านต้องตรงกับหัวข้อคำถามหรือมีคำร่วมกัน เพื่อลดการหยิบข้อมูลผิดเรื่อง
    const sharedBusinessTerm = [...queryTerms].some(term => bodyTerms.has(term));
    const relevant = exactFaq || (score >= 0.23 &&
      (row.source_type !== 'business' || businessMatch || sharedBusinessTerm));
    return { ...row, score, exactFaq, relevant };
  }).filter(row => row.relevant)
    .sort((a, b) => b.score - a.score || a.chunk_id.localeCompare(b.chunk_id));
  return ranked.filter(row => row.exactFaq || row.score >= ranked[0].score - 0.15)
    .slice(0, Math.min(Math.max(limit, 1), 8))
    .map(({ embedding_json, relevant, ...row }) => row);
}

// ใช้ฟังก์ชันเดียวกันทั้งตอนตอบจริงและตอนดูตัวอย่าง เพื่อให้หลักฐานตรงกัน
export async function prepareAnswerContext(db, { shopId, query }) {
  const shop = (await db.query('SELECT * FROM shops WHERE id=$1', [shopId])).rows[0];
  if (!shop) return null;
  const matches = await retrieve(db, { shopId, query, shop });
  const context = matches.map(({ chunk_id, knowledge_entry_id, source_type, title, content, score }) =>
    ({ chunkId: chunk_id, knowledgeEntryId: knowledge_entry_id, sourceType: source_type || 'knowledge', title, content, score }));
  return { shop, matches, context, prompt: buildAnswerPrompt({ shop, query, context }) };
}

// หากยังไม่ได้ต่อบริการ AI ภายนอก ระบบจะคัดข้อความจากหลักฐานที่ค้นพบแทน
export async function answerQuestion(db, { shopId, query, generator, signal, deadlineAt, jobId }) {
  signal?.throwIfAborted();
  const prepared = await prepareAnswerContext(db, { shopId, query });
  const matches = prepared?.matches || [];
  if (!matches.length) return { text: UNKNOWN_ANSWER, sources: [], method: 'no_evidence' };
  const exact = matches.find(match => match.exactFaq);
  if (exact) {
    return { text: exact.full_content.slice(0, 5000), sources: [exact], method: 'faq' };
  }
  if (generator) {
    try {
      const { context, prompt } = prepared;
      const generated = await generator.generate({ shopId, query, context,
        instruction: prompt.messages[0].content, prompt, signal, deadlineAt, jobId });
      signal?.throwIfAborted();
      if (generated?.insufficient === true) {
        return { text: UNKNOWN_ANSWER, sources: [], method: 'no_evidence' };
      }
      const valid = validateGeneratedAnswer(generated, context);
      const ids = valid?.sourceChunkIds || [];
      const sources = matches.filter(match => ids.includes(match.chunk_id));
      if (valid && sources.length === 1) {
        return { text: valid.text, sources, method: 'generator' };
      }
      if (generator.failurePolicy === 'handover') return handoverAnswer('AI_UNAVAILABLE');
    } catch (error) {
      signal?.throwIfAborted();
      if (generator.failurePolicy === 'handover') return handoverAnswer(
        error.code === 'AI_SAFETY_REFUSAL' ? 'AI_SAFETY_REFUSAL' : 'AI_UNAVAILABLE');
      // Legacy HTTP mode retains its grounded extractive fallback.
    }
  }
  // Extractive fallback preserves the source wording and avoids unsupported claims.
  return { text: matches[0].content.slice(0, 5000), sources: [matches[0]], method: 'extractive' };
}
