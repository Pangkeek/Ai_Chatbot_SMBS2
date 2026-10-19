import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// ใช้ DOM จริงของ component และ controller เดิมใน bundle เดียว เพื่อจำลอง module cache ตอนกลับจากหน้าแรก
const bundle = await build({
  stdin: {
    contents: `
      import React, { act } from 'react';
      import { createRoot } from 'react-dom/client';
      import Dashboard from './src/components/Dashboard.jsx';
      import HomeHeader from './src/components/home/HomeHeader.jsx';
      import HomeHero from './src/components/home/HomeHero.jsx';
      import HomeJourney from './src/components/home/HomeJourney.jsx';
      import HomeAccountProvider from './src/components/home/HomeAccountProvider.jsx';
      let root;
      globalThis.testUI = {
        async mount() {
          root = createRoot(document.getElementById('root'));
          await act(async () => root.render(<React.StrictMode><Dashboard /></React.StrictMode>));
        },
        async unmount() { await act(async () => root.unmount()); },
        async mountHome() {
          root = createRoot(document.getElementById('root'));
          await act(async () => root.render(<React.StrictMode><HomeAccountProvider><HomeHeader /><HomeHero /><HomeJourney /></HomeAccountProvider></React.StrictMode>));
        },
        async key(key) { await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))); },
        async clickOutside() { await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))); },
        async settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); }); },
        async click(id) { await act(async () => document.getElementById(id).click()); },
        async submit(id) {
          await act(async () => document.getElementById(id).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
        },
      };
    `,
    resolveDir: process.cwd(), loader: 'jsx',
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{
    name: 'test-next-navigation',
    setup(builder) {
      builder.onResolve({ filter: /^next\/(router|link|image)$/ }, args => ({ path: args.path, namespace: 'test-navigation' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-navigation' }, args => ({
        contents: args.path === 'next/router'
          ? 'export default globalThis.testRouter; export const useRouter = () => globalThis.testRouter;'
          : args.path === 'next/image'
            ? `import React from 'react'; export default function Image(props) { return React.createElement('img', props); }`
            : `import React from 'react'; export default function Link({children, ...props}) { return React.createElement('a', props, children); }`,
        resolveDir: process.cwd(),
      }));
    },
  }],
});

function createApp({ rejectSession = false, failureStatus, loggedIn = true } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app', runScripts: 'outside-only' });
  const { window } = dom;
  const listeners = new Set();
  const requests = [];
  const errors = [];
  window.IS_REACT_ACT_ENVIRONMENT = true;
  window.MessageChannel = class {
    port1 = {};
    port2 = { postMessage: () => window.setTimeout(() => this.port1.onmessage(), 0) };
  };
  window.scrollTo = () => {};
  window.console.error = (...args) => errors.push(args.join(' '));
  if (loggedIn) window.sessionStorage.setItem('smb_access_token', 'existing-session');
  window.fetch = async (url, options) => {
    requests.push({ url, options });
    if (rejectSession || failureStatus) return { ok: false, status: failureStatus || 401, json: async () => ({ error: { code: rejectSession ? 'UNAUTHORIZED' : 'UNAVAILABLE' } }) };
    const shop = { id: 'test-shop', name: 'Test shop', member_role: 'owner', description: '', persona: '', opening_hours: '' };
    const data = url.endsWith('/users/me') ? { name: 'Test owner', email: 'owner@example.test' }
      : url.endsWith('/auth/login') ? { access_token: 'existing-session' }
      : url.endsWith('/shops') ? (options.method === 'POST' ? shop : [shop])
      : url.endsWith('/shops/test-shop') ? shop : [];
    return { ok: true, json: async () => ({ data }) };
  };
  window.testRouter = {
    query: {},
    events: {
      on: (_event, callback) => listeners.add(callback),
      off: (_event, callback) => listeners.delete(callback),
    },
    async push(url) {
      window.history.pushState({}, '', url);
      for (const callback of [...listeners]) await callback(url);
    },
    async replace(url) { await this.push(url); },
  };
  window.eval(bundle.outputFiles[0].text);
  return { dom, window, listeners, requests, errors, ui: window.testUI };
}

test('returning from homepage restores the same session and rebinds logout once', async () => {
  const app = createApp();
  try {
    await app.ui.mount();
    await app.ui.settle();
    assert.ok(app.window.document.getElementById('auth-view').classList.contains('hidden'));
    for (let visit = 0; visit < 3; visit++) {
      await app.ui.unmount();
      await app.window.testRouter.push('/home');
      app.window.history.pushState({}, '', '/app');
      await app.ui.mount();
      await app.ui.settle();
      assert.ok(app.window.document.getElementById('auth-view').classList.contains('hidden'), 'Returning must restore the dashboard, not show login');
      assert.equal(app.window.document.getElementById('header-user-name').textContent, 'Test owner');
      assert.equal(app.window.sessionStorage.getItem('smb_access_token'), 'existing-session');
      assert.equal(app.listeners.size, 1, 'Only the mounted controller should handle route changes');
      await app.window.testRouter.push('/app/shops/test-shop/settings');
      await app.ui.settle();
      assert.ok(!app.window.document.getElementById('business-settings-view').classList.contains('hidden'));
      assert.equal(app.window.document.getElementById('settings-name').value, 'Test shop');
      await app.ui.click('settings-back-button');
      assert.equal(app.window.location.pathname, '/app');
    }
    await app.ui.click('logout-button');
    await app.ui.settle();
    assert.equal(app.requests.filter(request => request.url.endsWith('/auth/logout')).length, 1);
    assert.equal(app.window.sessionStorage.getItem('smb_access_token'), null);
    assert.ok(!app.window.document.getElementById('auth-view').classList.contains('hidden'));
    assert.deepEqual(app.errors, []);
    await app.ui.unmount();
    assert.equal(app.listeners.size, 0, 'Unmount must remove route listeners');
  } finally {
    app.dom.window.close();
  }
});

test('login remains usable after returning from homepage without a session', async () => {
  const app = createApp({ loggedIn: false });
  try {
    await app.ui.mount();
    await app.ui.unmount();
    await app.window.testRouter.push('/home');
    app.window.history.pushState({}, '', '/app');
    await app.ui.mount();
    await app.ui.settle();
    app.window.document.getElementById('login-email').value = 'owner@example.test';
    app.window.document.getElementById('login-password').value = 'TestPassword123!';
    await app.ui.submit('login-form');
    await app.ui.settle();
    assert.equal(app.requests.filter(request => request.url.endsWith('/auth/login')).length, 1);
    assert.equal(app.window.sessionStorage.getItem('smb_access_token'), 'existing-session');
    assert.ok(app.window.document.getElementById('auth-view').classList.contains('hidden'));
    assert.deepEqual(app.errors, []);
    await app.ui.unmount();
  } finally {
    app.dom.window.close();
  }
});

test('an expired session still returns to login', async () => {
  const app = createApp({ rejectSession: true });
  try {
    await app.ui.mount();
    await app.ui.settle();
    assert.equal(app.window.sessionStorage.getItem('smb_access_token'), null);
    assert.ok(!app.window.document.getElementById('auth-view').classList.contains('hidden'));
    await app.ui.unmount();
  } finally {
    app.dom.window.close();
  }
});

test('a temporary server error does not discard the account session', async () => {
  const app = createApp({ failureStatus: 503 });
  try {
    await app.ui.mount();
    await app.ui.settle();
    assert.equal(app.window.sessionStorage.getItem('smb_access_token'), 'existing-session');
    assert.ok(app.window.document.getElementById('auth-view').classList.contains('hidden'), 'A temporary error must not show login');
    await app.ui.unmount();
  } finally {
    app.dom.window.close();
  }
});

test('a late unauthorized response from an unmounted page cannot clear the current session', async () => {
  const app = createApp();
  const pending = [];
  const fetchCurrent = app.window.fetch;
  app.window.fetch = () => new Promise(resolve => pending.push(resolve));
  try {
    await app.ui.mount();
    await app.ui.settle();
    assert.equal(pending.length, 2);
    await app.ui.unmount();
    await app.window.testRouter.push('/home');
    app.window.history.pushState({}, '', '/app');
    app.window.fetch = fetchCurrent;
    await app.ui.mount();
    await app.ui.settle();
    for (const resolve of pending) resolve({ ok: false, status: 401, json: async () => ({ error: { code: 'UNAUTHORIZED' } }) });
    await app.ui.settle();
    assert.equal(app.window.sessionStorage.getItem('smb_access_token'), 'existing-session');
    assert.ok(app.window.document.getElementById('auth-view').classList.contains('hidden'));
    assert.equal(app.window.document.getElementById('header-user-name').textContent, 'Test owner');
    assert.deepEqual(app.errors, []);
    await app.ui.unmount();
  } finally {
    app.dom.window.close();
  }
});

test('homepage shows the signed-in account with shop navigation and working logout', async () => {
  const app = createApp();
  try {
    await app.ui.mount();
    await app.ui.settle();
    await app.ui.unmount();
    await app.window.testRouter.push('/home');
    await app.ui.mountHome();
    await app.ui.settle();
    const trigger = app.window.document.getElementById('home-account-button');
    assert.ok(trigger, 'Homepage must show the signed-in account');
    assert.match(trigger.getAttribute('aria-label'), /Test owner/);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    const primaryAction = app.window.document.querySelector('section a[href="/app"]');
    assert.match(primaryAction.textContent, /จัดการร้าน/);
    assert.doesNotMatch(primaryAction.textContent, /เข้าสู่ระบบ/);
    await app.ui.click('home-account-button');
    const dropdown = app.window.document.getElementById('home-account-dropdown');
    assert.ok(dropdown);
    assert.match(dropdown.textContent, /owner@example.test/);
    assert.equal(dropdown.querySelector('a').getAttribute('href'), '/app');
    assert.match(dropdown.querySelector('a').textContent, /จัดการร้าน/);
    await app.ui.click('home-logout-button');
    await app.ui.settle();
    const logout = app.requests.filter(request => request.url.endsWith('/auth/logout'));
    assert.equal(logout.length, 1);
    assert.equal(logout[0].options.method, 'POST');
    assert.equal(logout[0].options.headers.Authorization, 'Bearer existing-session');
    assert.equal(app.window.sessionStorage.getItem('smb_access_token'), null);
    assert.equal(app.window.document.getElementById('home-account-button'), null);
    assert.match(app.window.document.querySelector('header').textContent, /เข้าสู่ระบบ/);
    assert.match(primaryAction.textContent, /เข้าสู่ระบบ/);
    assert.deepEqual(app.errors, []);
    await app.ui.unmount();
  } finally {
    app.dom.window.close();
  }
});

test('account dropdown closes with Escape and an outside click', async () => {
  const app = createApp();
  try {
    await app.ui.mountHome();
    await app.ui.settle();
    const trigger = app.window.document.getElementById('home-account-button');
    trigger.focus();
    await app.ui.click('home-account-button');
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    await app.ui.key('Escape');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(app.window.document.activeElement, trigger);
    assert.equal(app.window.document.getElementById('home-account-dropdown'), null);
    await app.ui.click('home-account-button');
    await app.ui.clickOutside();
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(app.window.document.getElementById('home-account-dropdown'), null);
    assert.deepEqual(app.errors, []);
    await app.ui.unmount();
  } finally {
    app.dom.window.close();
  }
});

for (const options of [{ loggedIn: false }, { rejectSession: true }]) {
  test(`homepage shows guest actions for ${options.loggedIn === false ? 'visitors' : 'expired sessions'}`, async () => {
    const app = createApp(options);
    try {
      await app.ui.mountHome();
      await app.ui.settle();
      assert.equal(app.window.document.getElementById('home-account-button'), null);
      assert.match(app.window.document.querySelector('header').textContent, /เข้าสู่ระบบ/);
      assert.match(app.window.document.querySelector('section a[href="/app"]').textContent, /เข้าสู่ระบบ/);
      assert.equal(app.window.sessionStorage.getItem('smb_access_token'), null);
      if (options.loggedIn === false) assert.equal(app.requests.length, 0);
      assert.deepEqual(app.errors, []);
      await app.ui.unmount();
    } finally {
      app.dom.window.close();
    }
  });
}

test('a failed account lookup preserves the session and offers account actions', async () => {
  const app = createApp({ failureStatus: 503 });
  try {
    await app.ui.mountHome();
    await app.ui.settle();
    assert.equal(app.window.sessionStorage.getItem('smb_access_token'), 'existing-session');
    assert.match(app.window.document.querySelector('section a[href="/app"]').textContent, /จัดการร้าน/);
    await app.ui.click('home-account-button');
    const dropdown = app.window.document.getElementById('home-account-dropdown');
    assert.match(dropdown.textContent, /โหลดชื่อบัญชีไม่สำเร็จ/);
    assert.equal(dropdown.querySelector('a').getAttribute('href'), '/app');
    assert.ok(dropdown.querySelector('#home-logout-button'));
    await app.ui.unmount();
  } finally {
    app.dom.window.close();
  }
});

test('homepage offers the implemented conversation and handover workflow instead of calling it a future feature', async () => {
  const app = createApp({ loggedIn: false });
  try {
    await app.ui.mountHome();
    const explore = app.window.document.getElementById('explore');
    assert.ok(!explore.textContent.includes('อยู่ในแผนพัฒนา'));
    const card = [...explore.querySelectorAll('article')].find(node => node.textContent.includes('บทสนทนาและสถิติ'));
    assert.ok(card);
    assert.equal(card.querySelector('a').getAttribute('href'), '/app');
    assert.ok(card.textContent.includes('Pause/Resume'));
    await app.ui.unmount();
  } finally { app.dom.window.close(); }
});

test('homepage logout clears the local session even when the server cannot be reached', async () => {
  const app = createApp();
  try {
    await app.ui.mountHome();
    await app.ui.settle();
    await app.ui.click('home-account-button');
    app.window.fetch = async () => { throw new Error('Network unavailable'); };
    await app.ui.click('home-logout-button');
    await app.ui.settle();
    assert.equal(app.window.sessionStorage.getItem('smb_access_token'), null);
    assert.equal(app.window.document.getElementById('home-account-button'), null);
    assert.match(app.window.document.querySelector('header').textContent, /เข้าสู่ระบบ/);
    assert.deepEqual(app.errors, []);
    await app.ui.unmount();
  } finally {
    app.dom.window.close();
  }
});

test('create-shop form is hidden until requested and closes after a successful creation', async () => {
  const app = createApp();
  try {
    await app.ui.mount();
    await app.ui.settle();
    const form = app.window.document.getElementById('shop-form');
    const panel = form.closest('aside');
    assert.ok(panel.hidden, 'Creation form must be hidden on entry');
    const trigger = app.window.document.getElementById('create-shop-button');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    await app.ui.click('create-shop-button');
    assert.ok(!panel.hidden);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    const name = app.window.document.getElementById('shop-name');
    assert.equal(app.window.document.activeElement, name);
    name.value = 'Test shop';
    await app.ui.click('close-create-shop-button');
    assert.ok(panel.hidden);
    assert.equal(app.window.document.activeElement, trigger);
    await app.ui.click('create-shop-button');
    assert.equal(name.value, 'Test shop', 'Closing the panel must not lose an unfinished draft');
    await app.ui.submit('shop-form');
    await app.ui.settle();
    const created = app.requests.filter(request => request.url.endsWith('/shops') && request.options.method === 'POST');
    assert.equal(created.length, 1);
    assert.equal(JSON.parse(created[0].options.body).name, 'Test shop');
    assert.ok(panel.hidden, 'The form must close after a successful creation');
    assert.equal(app.window.location.pathname, '/app/shops/test-shop/settings');
    await app.ui.click('settings-back-button');
    assert.ok(panel.hidden, 'Returning to the shop list must not reopen the form');
    assert.deepEqual(app.errors, []);
    await app.ui.unmount();
  } finally {
    app.dom.window.close();
  }
});
