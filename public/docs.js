const $ = id => document.getElementById(id);
let token = '';
let endpoints = [];
const examples = {
  register: { email: 'new@example.test', name: 'New owner', password: 'YourPassword123!' },
  login: { email: 'coffee@example.test', password: 'DemoPass!2026' },
  createShop: { name: 'ร้านใหม่', description: 'ข้อมูลร้าน', opening_hours: '09:00-18:00', persona: 'สุภาพ เป็นกันเอง' },
  updateShop: { opening_hours: '08:00-17:00' },
  createKnowledge: { kind: 'faq', title: 'เปิดกี่โมง', content: 'เปิดทุกวัน 08:00-17:00', status: 'published' },
  updateKnowledge: { status: 'draft' },
  createConversation: { channel: 'web', customer_external_id: 'test-customer-1', customer_name: 'ลูกค้าทดสอบ' },
  updateConversation: { bot_mode: 'human' },
  createMessage: { role: 'customer', content: 'ร้านเปิดกี่โมงครับ' },
};
async function call(method, path, body) {
  if (!path.startsWith('/api/v1/') && path !== '/health') throw new Error('ใช้ path ภายใน /api/v1/ หรือ /health เท่านั้น');
  const result = await fetch(path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await result.text();
  const payload = text ? JSON.parse(text) : null;
  if (result.status === 401) { token = ''; $('auth-state').textContent = 'กรุณาเข้าสู่ระบบใหม่'; }
  $('request-state').textContent = `${method} ${path} → ${result.status} ${result.statusText}`;
  // Never print session tokens in the console output.
  const display = structuredClone(payload);
  if (display?.data?.access_token) display.data.access_token = '[hidden]';
  $('response').textContent = display ? JSON.stringify(display, null, 2) : '(ไม่มี response body)';
  return { result, payload };
}
$('login').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    token = '';
    const { result, payload } = await call('POST', '/api/v1/auth/login', { email: $('email').value, password: $('password').value });
    if (result.ok) { token = payload.data.access_token; $('auth-state').textContent = `เข้าสู่ระบบแล้ว: ${payload.data.user.name}`; }
  } catch (error) { $('auth-state').textContent = error.message; }
});
$('logout').addEventListener('click', async () => {
  try { await call('POST', '/api/v1/auth/logout'); }
  catch (error) { $('response').textContent = error.message; }
  finally { token = ''; $('auth-state').textContent = 'ออกจากระบบแล้ว'; }
});
$('endpoint').addEventListener('change', () => {
  const endpoint = endpoints[Number($('endpoint').value)];
  $('path').value = endpoint.path;
  $('body').value = JSON.stringify(examples[endpoint.operationId] || {}, null, 2);
  $('body').disabled = !endpoint.requestBody;
});
$('request').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const endpoint = endpoints[Number($('endpoint').value)];
    const { result, payload } = await call(endpoint.method, $('path').value, endpoint.requestBody ? JSON.parse($('body').value) : undefined);
    if (result.ok && payload?.data?.access_token) { token = payload.data.access_token; $('auth-state').textContent = `เข้าสู่ระบบแล้ว: ${payload.data.user.name}`; }
    if (result.ok && endpoint.operationId === 'logout') { token = ''; $('auth-state').textContent = 'ออกจากระบบแล้ว'; }
  } catch (error) { $('response').textContent = error.message; }
  finally { button.disabled = false; }
});
try {
  const spec = await (await fetch('/openapi.json')).json();
  endpoints = Object.entries(spec.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => ({ path, method: method.toUpperCase(), ...operation })));
  endpoints.forEach((endpoint, i) => { const option = document.createElement('option'); option.value = i; option.textContent = `${endpoint.method} ${endpoint.path}`; $('endpoint').append(option); });
  $('endpoint').value = endpoints.findIndex(endpoint => endpoint.operationId === 'listShops');
  $('endpoint').dispatchEvent(new Event('change'));
} catch (error) { $('response').textContent = `โหลด API contract ไม่สำเร็จ: ${error.message}`; }
