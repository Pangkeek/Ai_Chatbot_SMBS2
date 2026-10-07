import { createHash } from 'node:crypto';
import { transaction } from '../lib/db.js';

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
    .replace(/\s+/g, ' ').trim();
}

function terms(value) {
  const words = [...segmenter.segment(normalize(value))]
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

export function indexKnowledgeEntry(db, shopId, knowledgeEntryId) {
  const entry = db.prepare('SELECT * FROM knowledge_entries WHERE shop_id = ? AND id = ?').get(shopId, knowledgeEntryId);
  db.prepare('DELETE FROM knowledge_chunks WHERE shop_id = ? AND knowledge_entry_id = ?').run(shopId, knowledgeEntryId);
  if (!entry || entry.status !== 'published') return 0;
  const chunks = splitContent(entry.content);
  const insert = db.prepare(`INSERT INTO knowledge_chunks
    (id, shop_id, knowledge_entry_id, chunk_index, content, embedding_json, embedding_version, source_updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  chunks.forEach((content, index) => {
    const id = `${knowledgeEntryId}:${index}`;
    insert.run(id, shopId, knowledgeEntryId, index, content,
      JSON.stringify(embed(`${entry.title} ${content}`)), EMBEDDING_VERSION, entry.updated_at);
  });
  return chunks.length;
}

export function rebuildKnowledgeIndex(db) {
  return transaction(db, () => {
    db.prepare('DELETE FROM knowledge_chunks').run();
    const entries = db.prepare("SELECT shop_id, id FROM knowledge_entries WHERE status = 'published' ORDER BY shop_id, id").all();
    let chunks = 0;
    for (const entry of entries) chunks += indexKnowledgeEntry(db, entry.shop_id, entry.id);
    return { entries: entries.length, chunks };
  });
}

function cosine(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

export function retrieve(db, { shopId, query, limit = 4 }) {
  if (!shopId || !normalize(query)) return [];
  const searchQuery = /ส่ง|เดลิเวอรี่|delivery/i.test(query) ? `${query} การจัดส่ง` : query;
  const rows = db.prepare(`SELECT c.id AS chunk_id, c.knowledge_entry_id, c.content, c.embedding_json,
      e.kind, e.title, e.content AS full_content
    FROM knowledge_chunks c JOIN knowledge_entries e
      ON e.shop_id = c.shop_id AND e.id = c.knowledge_entry_id
    WHERE c.shop_id = ? AND e.status = 'published'
      AND c.embedding_version = ? AND c.source_updated_at = e.updated_at`).all(shopId, EMBEDDING_VERSION);
  const queryVector = embed(searchQuery);
  const queryTerms = terms(searchQuery);
  const ranked = rows.map(row => {
    const titleTerms = terms(row.title);
    const bodyTerms = terms(row.content);
    const titleHits = [...queryTerms].filter(term => titleTerms.has(term)).length;
    const bodyHits = [...queryTerms].filter(term => bodyTerms.has(term)).length;
    const overlap = queryTerms.size ? Math.min(1, (titleHits * 1.5 + bodyHits * 0.5) / queryTerms.size) : 0;
    const similarity = cosine(queryVector, JSON.parse(row.embedding_json));
    const exactFaq = row.kind === 'faq' && canonicalQuestion(query) === canonicalQuestion(row.title);
    const score = exactFaq ? 1 : 0.6 * similarity + 0.4 * overlap;
    return { ...row, score, exactFaq };
  }).filter(row => row.exactFaq || row.score >= 0.23)
    .sort((a, b) => b.score - a.score || a.chunk_id.localeCompare(b.chunk_id));
  return ranked.filter(row => row.exactFaq || row.score >= ranked[0].score - 0.15)
    .slice(0, Math.min(Math.max(limit, 1), 8))
    .map(({ embedding_json, ...row }) => row);
}

// A generator can be injected by the next AI integration. It receives only the
// tenant-filtered context. The default keeps the application useful offline.
export async function answerQuestion(db, { shopId, query, generator }) {
  const matches = retrieve(db, { shopId, query });
  if (!matches.length) return { text: UNKNOWN_ANSWER, sources: [], method: 'no_evidence' };
  const exact = matches.find(match => match.exactFaq);
  if (exact) {
    return { text: exact.full_content.slice(0, 5000), sources: [exact], method: 'faq' };
  }
  const context = matches.map(({ chunk_id, knowledge_entry_id, title, content, score }) =>
    ({ chunkId: chunk_id, knowledgeEntryId: knowledge_entry_id, title, content, score }));
  if (generator) {
    try {
      const generated = await generator.generate({ shopId, query, context,
        instruction: 'Select an exact quote from one supplied context chunk as the answer. Do not paraphrase or add claims. Return its chunk ID. If insufficient, say you do not know.' });
      if (generated?.insufficient === true) {
        return { text: UNKNOWN_ANSWER, sources: [], method: 'no_evidence' };
      }
      const ids = Array.isArray(generated?.sourceChunkIds) ? generated.sourceChunkIds : [];
      const sources = matches.filter(match => ids.includes(match.chunk_id));
      if (typeof generated?.text === 'string' && generated.text.trim() && ids.length === 1 &&
          sources.length === 1 && generated.text.length <= 5000 &&
          sources[0].content.includes(generated.text.trim())) {
        return { text: generated.text.trim(), sources, method: 'generator' };
      }
    } catch { /* A failed provider cannot invent an answer. */ }
  }
  // Extractive fallback preserves the source wording and avoids unsupported claims.
  return { text: matches[0].content.slice(0, 5000), sources: [matches[0]], method: 'extractive' };
}
