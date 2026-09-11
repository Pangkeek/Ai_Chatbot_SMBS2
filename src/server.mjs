import { openDatabase } from './db.mjs';
import { createApp } from './app.mjs';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
const db = openDatabase();
const app = createApp(db);
app.on('error', error => { console.error(error.message); db.close(); process.exitCode = 1; });
app.listen(port, host, () => console.log(`SMB Chatbot API: http://${host}:${port}/docs`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  app.close(() => { db.close(); process.exit(0); });
  app.closeIdleConnections();
});
