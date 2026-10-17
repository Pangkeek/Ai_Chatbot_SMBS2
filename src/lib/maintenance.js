import { randomUUID } from 'node:crypto';

export function maintenanceEnabled() {
  return process.env.APP_MAINTENANCE_MODE === 'true';
}

// Health remains a database readiness check. All other API requests are rejected
// before authentication, body parsing, or lazy database initialization.
export function rejectMaintenanceRequest(req, res) {
  if (!maintenanceEnabled()) return false;
  const path = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && path === '/health') return false;
  const requestId = randomUUID();
  res.statusCode = 503;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Retry-After', '60');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  req.resume();
  res.end(JSON.stringify({ error: { code: 'MAINTENANCE_MODE', message: 'Service temporarily unavailable for maintenance', details: [] }, request_id: requestId }));
  return true;
}
