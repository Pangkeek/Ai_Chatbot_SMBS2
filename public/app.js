const API_BASE = '/api/v1';
const TOKEN_KEY = 'smb_access_token';

let accessToken = sessionStorage.getItem(TOKEN_KEY) || '';

const authSection = document.querySelector('#auth-section');
const dashboardSection = document.querySelector('#dashboard-section');
const statusElement = document.querySelector('#status');
const currentUserElement = document.querySelector('#current-user');
const shopListElement = document.querySelector('#shop-list');
const shopDetailElement = document.querySelector('#shop-detail');

function showStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.style.color = isError ? 'crimson' : 'green';
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload.error?.message ||
      `เกิดข้อผิดพลาด HTTP ${response.status}`;

    throw new Error(message);
  }

  return payload.data;
}

function saveSession(authData) {
  accessToken = authData.access_token;
  sessionStorage.setItem(TOKEN_KEY, accessToken);
}

function clearSession() {
  accessToken = '';
  sessionStorage.removeItem(TOKEN_KEY);

  authSection.hidden = false;
  dashboardSection.hidden = true;
  currentUserElement.textContent = '';
  shopListElement.replaceChildren();
  shopDetailElement.textContent = 'ยังไม่ได้เลือกร้าน';
}

async function openShop(shopId) {
  try {
    // Server จะตรวจว่า user เป็นสมาชิกของ shopId นี้หรือไม่
    const shop = await apiRequest(
      `/shops/${encodeURIComponent(shopId)}`
    );

    shopDetailElement.textContent = JSON.stringify(shop, null, 2);
  } catch (error) {
    showStatus(error.message, true);
  }
}

async function loadDashboard() {
  try {
    const [user, shops] = await Promise.all([
      apiRequest('/users/me'),
      apiRequest('/shops'),
    ]);

    authSection.hidden = true;
    dashboardSection.hidden = false;

    currentUserElement.textContent =
      `${user.name} (${user.email})`;

    shopListElement.replaceChildren();

    if (shops.length === 0) {
      const item = document.createElement('li');
      item.textContent = 'ยังไม่มีร้าน กรุณาสร้างร้านก่อน';
      shopListElement.append(item);
      return;
    }

    for (const shop of shops) {
      const item = document.createElement('li');
      const button = document.createElement('button');

      button.type = 'button';
      button.textContent = shop.name;
      button.addEventListener('click', () => openShop(shop.id));

      item.append(button);
      shopListElement.append(item);
    }
  } catch (error) {
    clearSession();
    showStatus(
      `Session ใช้งานไม่ได้ กรุณาเข้าสู่ระบบใหม่: ${error.message}`,
      true
    );
  }
}

document
  .querySelector('#register-form')
  .addEventListener('submit', async event => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    try {
      const authData = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
        },
      });

      saveSession(authData);
      event.currentTarget.reset();

      showStatus('สมัครสมาชิกสำเร็จ');
      await loadDashboard();
    } catch (error) {
      showStatus(error.message, true);
    }
  });

document
  .querySelector('#login-form')
  .addEventListener('submit', async event => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    try {
      const authData = await apiRequest('/auth/login', {
        method: 'POST',
        body: {
          email: form.get('email'),
          password: form.get('password'),
        },
      });

      saveSession(authData);
      event.currentTarget.reset();

      showStatus('เข้าสู่ระบบสำเร็จ');
      await loadDashboard();
    } catch (error) {
      showStatus(error.message, true);
    }
  });

document
  .querySelector('#shop-form')
  .addEventListener('submit', async event => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    try {
      await apiRequest('/shops', {
        method: 'POST',
        body: {
          name: form.get('name'),
        },
      });

      event.currentTarget.reset();
      showStatus('สร้างร้านสำเร็จ');

      await loadDashboard();
    } catch (error) {
      showStatus(error.message, true);
    }
  });

document
  .querySelector('#logout-button')
  .addEventListener('click', async () => {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
      });
    } catch {
      // ถึง server จะติดต่อไม่ได้ ก็ลบ token ฝั่ง browser
    } finally {
      clearSession();
      showStatus('ออกจากระบบแล้ว');
    }
  });

if (accessToken) {
  loadDashboard();
}