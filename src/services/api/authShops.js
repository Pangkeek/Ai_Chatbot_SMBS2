import { randomUUID } from 'node:crypto';
import { transaction } from '../../lib/db.js';
import { hashPassword, verifyPassword, createSession } from '../../lib/auth.js';
import { ApiError } from '../../utils/validation.js';
import { publicUser, now, wrap } from './common.js';

// รวมคำสั่ง API ที่เกี่ยวกับ authShops ไว้ในไฟล์เดียว
export function createAuthShopsOperations(db, { shopForUser, patch }) {
  return {
    health() { db.prepare('SELECT 1').get(); return wrap({ status: 'ok', database: 'ok' }); },
    async register({ body }) {
      const email = body.email.toLowerCase();
      const passwordHash = await hashPassword(body.password);
      return transaction(db, () => {
        if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new ApiError(409, 'EMAIL_EXISTS', 'Email is already registered');
        const user = { id: randomUUID(), email, name: body.name.trim(), created_at: now() };
        db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run(user.id, email, user.name, passwordHash, user.created_at);
        return wrap({ user, ...createSession(db, user.id) });
      });
    },
    async login({ body }) {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email.toLowerCase());
      // ตรวจรหัสผ่านแม้ไม่พบบัญชี เพื่อให้เวลาในการตอบกลับใกล้เคียงกัน
      const dummy = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
      const valid = await verifyPassword(body.password, user?.password_hash || dummy);
      if (!user || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      return wrap({ user: publicUser(user), ...createSession(db, user.id) });
    },
    logout({ sessionHash }) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sessionHash); },
    me({ user }) { return wrap(publicUser(user)); },
    listShops({ user, query }) {
      const { limit, offset } = query;
      const total = db.prepare('SELECT count(*) AS n FROM shop_memberships WHERE user_id = ?').get(user.id).n;
      const rows = db.prepare(`SELECT s.*, m.role AS member_role
        FROM shops s
        JOIN shop_memberships m ON m.shop_id = s.id
        WHERE m.user_id = ?
        ORDER BY s.created_at, s.id LIMIT ? OFFSET ?`).all(user.id, limit, offset);
      return { data: rows, meta: { limit, offset, total } };
    },
    createShop({ user, body }) {
      return transaction(db, () => {
        const id = randomUUID(), time = now();
        db.prepare('INSERT INTO shops VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, body.name.trim(), body.description || '', body.opening_hours || '', body.persona || '', time, time);
        db.prepare('INSERT INTO shop_memberships VALUES (?, ?, ?, ?)').run(id, user.id, 'owner', time);
        return wrap({ ...db.prepare('SELECT * FROM shops WHERE id = ?').get(id), member_role: 'owner' });
      });
    },
    getShop({ params, user }) { return wrap(shopForUser(params.shopId, user.id)); },
    updateShop({ params, body, user }) {
      patch('shops', body, 'id = ?', [params.shopId]);
      return this.getShop({ params, user });
    },
  };
}
