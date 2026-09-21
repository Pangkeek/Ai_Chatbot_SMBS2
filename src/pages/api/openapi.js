import { handleApiRequest } from '../../lib/apiRuntime.js';

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  req.url = '/openapi.json';
  return handleApiRequest(req, res);
}
