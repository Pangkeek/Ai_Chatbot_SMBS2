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
      let root;
      globalThis.testUI = {
        async mount() {
          root = createRoot(document.getElementById('root'));
          await act(async () => root.render(<React.StrictMode><Dashboard /></React.StrictMode>));
        },
        async unmount() { await act(async () => root.unmount()); },
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
      builder.onResolve({ filter: /^next\/(router|link)$/ }, args => ({ path: args.path, namespace: 'test-navigation' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-navigation' }, args => ({
        contents: args.path === 'next/router'
          ? 'export default globalThis.testRouter; export const useRouter = () => globalThis.testRouter;'
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
      : url.endsWith('/shops') ? [shop]
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
