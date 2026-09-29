import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchAllKnowledgeEntries,
  filterKnowledgeEntries,
  paginateKnowledgeEntries,
} from '../src/services/knowledgeManager.js';

const entries = [
  { id: '1', kind: 'faq', status: 'published', title: 'ร้านเปิดกี่โมง', content: 'เปิดทุกวัน 08:00 น.' },
  { id: '2', kind: 'product', status: 'draft', title: 'ลาเต้เย็น', content: 'กาแฟนมราคา 65 บาท' },
  { id: '3', kind: 'policy', status: 'published', title: 'การคืนสินค้า', content: 'คืนได้ภายใน 7 วัน' },
];

test('knowledge filters search both title and content with kind and status', () => {
  assert.deepEqual(
    filterKnowledgeEntries(entries, { query: '08:00', kind: 'all', status: 'all' }).map(row => row.id),
    ['1'],
  );
  assert.deepEqual(
    filterKnowledgeEntries(entries, { query: 'กาแฟ', kind: 'product', status: 'draft' }).map(row => row.id),
    ['2'],
  );
  assert.deepEqual(
    filterKnowledgeEntries(entries, { query: '', kind: 'all', status: 'published' }).map(row => row.id),
    ['1', '3'],
  );
});

test('knowledge pagination clamps pages after filters or deletion', () => {
  const rows = Array.from({ length: 18 }, (_, index) => ({ id: String(index + 1) }));
  const second = paginateKnowledgeEntries(rows, 2, 8);
  assert.equal(second.page, 2);
  assert.equal(second.entries.length, 8);
  assert.equal(second.entries[0].id, '9');

  const clamped = paginateKnowledgeEntries(rows.slice(0, 3), 3, 8);
  assert.equal(clamped.page, 1);
  assert.deepEqual(clamped.entries.map(row => row.id), ['1', '2', '3']);
});

test('knowledge loader reads every API page beyond the 100 row limit', async () => {
  const rows = Array.from({ length: 205 }, (_, index) => ({ id: String(index + 1) }));
  const offsets = [];
  const loaded = await fetchAllKnowledgeEntries({
    shopId: 'shop/with spaces',
    apiRequest: async (path, options) => {
      assert.equal(options.withMeta, true);
      assert.match(path, /^\/shops\/shop%2Fwith%20spaces\/knowledge\?limit=100&offset=/);
      const offset = Number(new URL(`http://local${path}`).searchParams.get('offset'));
      offsets.push(offset);
      return {
        data: rows.slice(offset, offset + 100),
        meta: { limit: 100, offset, total: rows.length },
      };
    },
  });
  assert.deepEqual(offsets, [0, 100, 200]);
  assert.equal(loaded.length, 205);
  assert.equal(loaded.at(-1).id, '205');
});
