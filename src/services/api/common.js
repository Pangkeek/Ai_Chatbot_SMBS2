import { ApiError } from '../../utils/validation.js';
import { countToNumber } from '../../lib/postgresql-schema.js';
export const publicUser = user => ({ id: user.id, email: user.email, name: user.name, created_at: user.created_at });
export const now = () => new Date().toISOString();
export const missing = () => { throw new ApiError(404, 'NOT_FOUND', 'Resource not found'); };
export const wrap = value => ({ data: value });

export function createDbHelpers(db) {
  const editable = {
    shops: ['name', 'description', 'opening_hours', 'persona'],
    knowledge_entries: ['kind', 'title', 'content', 'status'],
    conversations: ['status', 'bot_mode'],
    messages: [],
  };
  function checkTable(table) { if (!Object.hasOwn(editable, table)) throw new Error('Invalid internal table'); }
  const placeholders = (where, start = 0) => where.replaceAll('?', () => `$${++start}`);
  async function get(table, shopId, id, executor = db, lock = false) {
    checkTable(table);
    return (await executor.query(`SELECT * FROM ${table} WHERE shop_id = $1 AND id = $2${lock ? ' FOR UPDATE' : ''}`, [shopId, id])).rows[0] || missing();
  }
  async function page(table, where, values, query) {
    checkTable(table);
    where = placeholders(where);
    const { limit, offset } = query;
    const total = (await db.query(`SELECT count(*) AS n FROM ${table} WHERE ${where}`, [...values])).rows[0].n;
    const rows = (await db.query(`SELECT * FROM ${table} WHERE ${where} ORDER BY created_at, id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset])).rows;
    return { data: rows, meta: { limit, offset, total: countToNumber(total) } };
  }
  async function patch(table, body, where, values) {
    checkTable(table);
    if (Object.keys(body).some(key => !editable[table].includes(key))) throw new ApiError(422, 'VALIDATION_ERROR', 'Unsupported update field');
    const changes = { ...body, updated_at: now() };
    await db.query(`UPDATE ${table} SET ${Object.keys(changes).map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE ${placeholders(where, Object.keys(changes).length)}`, [...Object.values(changes), ...values]);
  }
  async function shopForUser(shopId, userId) {
    return (await db.query(`SELECT s.*, m.role AS member_role
      FROM shops s
      JOIN shop_memberships m ON m.shop_id = s.id
      WHERE s.id = $1 AND m.user_id = $2`, [shopId, userId])).rows[0] || missing();
  }
  return { get, page, patch, shopForUser };
}
