import { handleApiRequest } from '../../lib/apiRuntime.js';

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  req.url = '/health' + new URL(req.url, 'http://localhost').search;
  return handleApiRequest(req, res);
}
