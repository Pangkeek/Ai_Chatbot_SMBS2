import { randomUUID } from 'node:crypto';
import { transaction } from '../../lib/db.js';
import { hashPassword, verifyPassword, createSession } from '../../lib/auth.js';
import { ApiError } from '../../utils/validation.js';
import { countToNumber } from '../../lib/postgresql-schema.js';

import { publicUser, now, wrap } from './common.js';

export function createAuthShopsOperations(db, { patch, shopForUser }) {
  return {
    async health() {
      try { await db.query('SELECT 1'); } catch { throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database unavailable'); }
      return wrap({ status: 'ok', database: 'ok' });
    },
    async register({ body }) {
      const email = body.email.toLowerCase();
      const passwordHash = await hashPassword(body.password);
      try { return await transaction(db, async tx => {
        if ((await tx.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email])).rows[0]) throw new ApiError(409, 'EMAIL_EXISTS', 'Email is already registered');
        const user = { id: randomUUID(), email, name: body.name.trim(), created_at: now() };
        await tx.query('INSERT INTO users (id,email,name,password_hash,created_at) VALUES ($1, $2, $3, $4, $5)', [user.id, email, user.name, passwordHash, user.created_at]);
        return wrap({ user, ...await createSession(tx, user.id) });
      }); } catch (error) {
        if (error.code === '23505' && error.constraint === 'users_email_lower_idx') throw new ApiError(409, 'EMAIL_EXISTS', 'Email is already registered');
        throw error;
      }
    },
    async login({ body }) {
      const user = (await db.query('SELECT * FROM users WHERE lower(email) = lower($1)', [body.email.toLowerCase()])).rows[0];
      // Perform scrypt even for unknown accounts to reduce account timing differences.
      const dummy = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
      const valid = await verifyPassword(body.password, user?.password_hash || dummy);
      if (!user || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      return wrap({ user: publicUser(user), ...await transaction(db, tx => createSession(tx, user.id)) });
    },
    async logout({ sessionHash }) { (await db.query('DELETE FROM sessions WHERE token_hash = $1', [sessionHash])); },
    async me({ user }) { return wrap(publicUser(user)); },
    async listShops({ user, query }) {
      const { limit, offset } = query;
      const total = (await db.query('SELECT count(*) AS n FROM shop_memberships WHERE user_id = $1', [user.id])).rows[0].n;
      const rows = (await db.query(`SELECT s.*, m.role AS member_role
        FROM shops s
        JOIN shop_memberships m ON m.shop_id = s.id
        WHERE m.user_id = $1
        ORDER BY s.created_at, s.id LIMIT $2 OFFSET $3`, [user.id, limit, offset])).rows;
      return { data: rows, meta: { limit, offset, total: countToNumber(total) } };
    },
    async createShop({ user, body }) {
      return transaction(db, async tx => {
        const id = randomUUID(), time = now();
        await tx.query('INSERT INTO shops (id,name,description,opening_hours,persona,created_at,updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, body.name.trim(), body.description || '', body.opening_hours || '', body.persona || '', time, time]);
        await tx.query('INSERT INTO shop_memberships (shop_id,user_id,role,created_at) VALUES ($1, $2, $3, $4)', [id, user.id, 'owner', time]);
        return wrap({ ...(await tx.query('SELECT * FROM shops WHERE id = $1', [id])).rows[0], member_role: 'owner' });
      });
    },
    async getShop({ params, user }) { return wrap(await shopForUser(params.shopId, user.id)); },
    async updateShop({ params, body, user }) {
      await patch('shops', body, 'id = ?', [params.shopId]);
      return this.getShop({ params, user });
    },
  };
}
