import { ApiError } from '../../utils/validation.js';

export const publicUser = user => ({ id: user.id, email: user.email, name: user.name, created_at: user.created_at });
export const now = () => new Date().toISOString();
export const missing = () => { throw new ApiError(404, 'NOT_FOUND', 'Resource not found'); };
export const wrap = value => ({ data: value });

// ฟังก์ชันฐานข้อมูลที่หลายกลุ่ม API ใช้ร่วมกัน
export function createDbHelpers(db) {
  function get(table, shopId, id) {
    // ชื่อตารางมาจากโค้ดภายในเท่านั้น ส่วนค่าจากผู้ใช้ส่งผ่าน parameter
    return db.prepare(`SELECT * FROM ${table} WHERE shop_id = ? AND id = ?`).get(shopId, id) || missing();
  }
  function page(table, where, values, query) {
    const { limit, offset } = query;
    const total = db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${where}`).get(...values).n;
    const rows = db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY created_at, id LIMIT ? OFFSET ?`).all(...values, limit, offset);
    return { data: rows, meta: { limit, offset, total } };
  }
  function patch(table, body, where, values) {
    const changes = { ...body, updated_at: now() };
    db.prepare(`UPDATE ${table} SET ${Object.keys(changes).map(k => `${k} = ?`).join(', ')} WHERE ${where}`).run(...Object.values(changes), ...values);
  }
  function shopForUser(shopId, userId) {
    return db.prepare(`SELECT s.*, m.role AS member_role
      FROM shops s
      JOIN shop_memberships m ON m.shop_id = s.id
      WHERE s.id = ? AND m.user_id = ?`).get(shopId, userId) || missing();
  }
  return { get, page, patch, shopForUser };
}
