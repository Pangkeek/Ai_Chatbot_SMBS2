import { handleApiRequest } from '../../../lib/apiRuntime.js';

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  return handleApiRequest(req, res);
}
