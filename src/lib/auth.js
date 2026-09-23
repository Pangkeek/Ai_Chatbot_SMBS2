import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password, encoded) {
  const [algorithm, salt, hex] = encoded.split(":");
  if (algorithm !== "scrypt" || !salt || !hex) return false;
  const key = await derive(password, salt, 64);
  const stored = Buffer.from(hex, "hex");
  return key.length === stored.length && timingSafeEqual(key, stored);
}
export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export function createSession(db, userId) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires_at = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(
    now.toISOString()
  );
  db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)").run(
    tokenHash(token),
    userId,
    expires_at,
    now.toISOString()
  );
  return { access_token: token, token_type: "Bearer", expires_at };
}
