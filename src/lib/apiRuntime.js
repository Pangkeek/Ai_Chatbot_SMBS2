import { createRequestHandler } from './app.js';
import { openDatabase } from './db.js';

let handler;

export function handleApiRequest(req, res) {
  if (!handler) handler = createRequestHandler(openDatabase());
  return handler(req, res);
}
