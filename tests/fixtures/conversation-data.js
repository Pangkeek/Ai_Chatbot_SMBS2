// ระบุคอลัมน์ชัดเจนและใช้ PostgreSQL จริง ไม่ทำ adapter เลียนแบบ SQLite
export function insertConversation(db, ...values) {
  return db.query(`INSERT INTO conversations
    (id,shop_id,channel,customer_external_id,customer_name,status,bot_mode,created_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, values);
}

export function insertMessage(db, ...values) {
  return db.query(`INSERT INTO messages
    (id,shop_id,conversation_id,role,content,author_user_id,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`, values);
}
