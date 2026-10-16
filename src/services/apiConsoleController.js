import { requestExamples } from './apiConsole/examples.js';

const element = (id) => document.getElementById(id);
let token = '';
let endpoints = [];

async function sendRequest(method, path, body) {
  if (!path.startsWith('/api/v1/') && path !== '/health') {
    throw new Error('ใช้ path ภายใน /api/v1/ หรือ /health เท่านั้น');
  }

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const result = await fetch(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await result.text();
  const payload = text ? JSON.parse(text) : null;

  if (result.status === 401) {
    token = '';
    element('auth-state').textContent = 'กรุณาเข้าสู่ระบบใหม่';
  }
  element('request-state').textContent = `${method} ${path} → ${result.status} ${result.statusText}`;

  // ซ่อน token ก่อนแสดงผล เพื่อไม่ให้คัดลอกข้อมูลลับไปพร้อมตัวอย่าง response
  const display = structuredClone(payload);
  if (display?.data?.access_token) display.data.access_token = '[hidden]';
  element('response').textContent = display
    ? JSON.stringify(display, null, 2)
    : '(ไม่มี response body)';

  return { result, payload };
}

function showLoggedInUser(authData) {
  token = authData.access_token;
  element('auth-state').textContent = `เข้าสู่ระบบแล้ว: ${authData.user.name}`;
}

function bindAuthentication() {
  element('login').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      token = '';
      const { result, payload } = await sendRequest('POST', '/api/v1/auth/login', {
        email: element('email').value,
        password: element('password').value,
      });
      if (result.ok) showLoggedInUser(payload.data);
    } catch (error) {
      element('auth-state').textContent = error.message;
    }
  });

  element('logout').addEventListener('click', async () => {
    try {
      await sendRequest('POST', '/api/v1/auth/logout');
    } catch (error) {
      element('response').textContent = error.message;
    } finally {
      token = '';
      element('auth-state').textContent = 'ออกจากระบบแล้ว';
    }
  });
}

function bindRequestForm() {
  element('endpoint').addEventListener('change', () => {
    const endpoint = endpoints[Number(element('endpoint').value)];
    element('path').value = endpoint.path;
    element('body').value = JSON.stringify(requestExamples[endpoint.operationId] || {}, null, 2);
    element('body').disabled = !endpoint.requestBody;
  });

  element('request').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;

    try {
      const endpoint = endpoints[Number(element('endpoint').value)];
      const body = endpoint.requestBody ? JSON.parse(element('body').value) : undefined;
      const { result, payload } = await sendRequest(endpoint.method, element('path').value, body);
      if (result.ok && payload?.data?.access_token) showLoggedInUser(payload.data);
      if (result.ok && endpoint.operationId === 'logout') {
        token = '';
        element('auth-state').textContent = 'ออกจากระบบแล้ว';
      }
    } catch (error) {
      element('response').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

async function loadEndpoints() {
  try {
    const spec = await (await fetch('/openapi.json')).json();
    endpoints = Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => ({
        path,
        method: method.toUpperCase(),
        ...operation,
      }))
    );

    for (const [index, endpoint] of endpoints.entries()) {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${endpoint.method} ${endpoint.path}`;
      element('endpoint').append(option);
    }
    element('endpoint').value = endpoints.findIndex((endpoint) => endpoint.operationId === 'listShops');
    element('endpoint').dispatchEvent(new Event('change'));
  } catch (error) {
    element('response').textContent = `โหลด API contract ไม่สำเร็จ: ${error.message}`;
  }
}

// controller ถูกโหลดหลัง component แสดงบน browser แล้ว
bindAuthentication();
bindRequestForm();
loadEndpoints();
