import nextServer from 'next/dist/server/lib/start-server.js';
// Emit real Node signal events on Windows too; the actual Next server and
// instrumentation handlers execute unchanged. Hard-crash coverage is separate.
process.on('message', message => { if (['SIGINT','SIGTERM'].includes(message.signal)) process.emit(message.signal); });
await nextServer.startServer({ dir: process.cwd(), isDev: false, port: Number(process.env.PORT), hostname: '127.0.0.1' });
