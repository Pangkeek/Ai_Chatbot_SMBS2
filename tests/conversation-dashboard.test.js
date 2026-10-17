import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { openDatabase } from '../src/lib/db.js';
import { seedDemo, demoPassword } from '../src/lib/seed.js';
import { createApp } from '../src/lib/app.js';

// ทดสอบ component/controller จริงกับ HTTP API และฐานข้อมูลชั่วคราว ไม่ใช้ยอดจำลองแทน API
const bundle = await build({
  stdin: { contents: `
    import React, { act } from 'react';
    import { createRoot } from 'react-dom/client';
    import Dashboard from './src/components/Dashboard.jsx';
    let root;
    globalThis.ui = {
      async mount() { root = createRoot(document.getElementById('root')); await act(async () => root.render(<React.StrictMode><Dashboard /></React.StrictMode>)); },
      async unmount() { await act(async () => root.unmount()); },
      async click(id) { await act(async () => document.getElementById(id).click()); },
      async submit(id) { await act(async () => document.getElementById(id).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); },
      async settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); }); },
    };`, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'test-router', setup(builder) {
    builder.onResolve({ filter: /^next\/(router|link)$/ }, args => ({ path: args.path, namespace: 'navigation' }));
    builder.onLoad({ filter: /.*/, namespace: 'navigation' }, args => ({
      contents: args.path === 'next/router' ? 'export default globalThis.testRouter; export const useRouter = () => globalThis.testRouter;'
        : `import React from 'react'; export default function Link({children, ...props}) { return React.createElement('a', props, children); }`,
      resolveDir: process.cwd(),
    }));
  } }],
});

async function fixture() {
  const db = openDatabase(':memory:');
  await seedDemo(db);
  const time = '2026-10-17T00:00:00.000Z';
  const add = db.prepare('INSERT INTO conversations VALUES (?,?,?,?,?,?,?,?,?)');
  for (let index = 0; index < 25; index++) {
    add.run(`ui-${String(index).padStart(3, '0')}`, 'shop-coffee', 'line', `U-${index}`, `ลูกค้า ${index}`, 'open', 'active', time, time);
  }
  const message = db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?,?)');
  for (let index = 0; index < 60; index++) {
    message.run(`ui-msg-${index}`, 'shop-coffee', 'ui-024', 'customer', `ข้อความ ${index}`, null, new Date(Date.parse(time) + index * 1000).toISOString());
  }
  message.run('ui-xss', 'shop-coffee', 'ui-024', 'customer', '<img src=x onerror=alert(1)>', null, '2026-10-17T00:02:00.000Z');
  const server = createApp(db, { logErrors: false });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'coffee@example.test', password: demoPassword }) });
  const token = (await response.json()).data.access_token;
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/shops/shop-coffee/conversations', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const errors = [], requests = [], listeners = new Set();
  const controls = { fail: false, hold: null };
  const polls = new Map();
  const originalSetTimeout = window.setTimeout.bind(window);
  const originalClearTimeout = window.clearTimeout.bind(window);
  let timerId = 1000000;
  window.setTimeout = (callback, delay, ...args) => {
    if (delay !== 15000) return originalSetTimeout(callback, delay, ...args);
    const id = ++timerId; polls.set(id, callback); return id;
  };
  window.clearTimeout = id => { if (!polls.delete(id)) originalClearTimeout(id); };
  window.IS_REACT_ACT_ENVIRONMENT = true;
  window.MessageChannel = class { port1 = {}; port2 = { postMessage: () => window.setTimeout(() => this.port1.onmessage(), 0) }; };
  window.scrollTo = () => {};
  window.console.error = (...args) => errors.push(args.join(' '));
  window.sessionStorage.setItem('smb_access_token', token);
  window.fetch = async (path, options) => {
    requests.push(path);
    if (controls.hold && path.includes('/shops/shop-coffee/statistics')) await controls.hold;
    if (controls.fail && path.includes('/statistics')) return new Response(JSON.stringify({ error: { message: 'ทดสอบเครือข่ายขัดข้อง' } }), { status: controls.failStatus || 503 });
    // Node fetch ใช้ signal คนละ realm; ยังตรวจการยกเลิกทั้งก่อนและหลังอ่าน HTTP
    options.signal?.throwIfAborted();
    const result = await fetch(base + path, { ...options, signal: undefined });
    options.signal?.throwIfAborted();
    return result;
  };
  window.testRouter = { query: {}, events: { on: (_event, fn) => listeners.add(fn), off: (_event, fn) => listeners.delete(fn) },
    async push(path) { window.history.pushState({}, '', path); for (const fn of listeners) fn(path); },
    async replace(path) { await this.push(path); },
  };
  window.eval(bundle.outputFiles[0].text);
  const ui = window.ui;
  const document = window.document;
  async function until(check) {
    for (let index = 0; index < 150; index++) { if (check()) return; await ui.settle(); }
    assert.ok(check(), document.body.textContent.slice(-1800));
  }
  return { db, server, base, token, window, document, ui, errors, requests, controls, until, polls,
    async close() { await ui.unmount(); dom.window.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close(); } };
}

test('conversation screen reads real statistics, pages rooms and safely shows paged history after remount', async () => {
  const app = await fixture();
  try {
    await app.ui.mount();
    assert.ok(app.document.getElementById('conversations-section'), 'ต้องมีหน้าบทสนทนา');
    await app.until(() => app.document.querySelector('[data-stat="total_messages"]')?.textContent === '63');
    assert.equal(app.document.querySelector('[data-stat="total_conversations"]').textContent, '26');
    assert.equal(app.document.querySelectorAll('[data-conversation-id]').length, 20);
    await app.ui.click('conversation-room-ui-024');
    await app.until(() => app.document.getElementById('conversation-messages')?.textContent.includes('<img src=x'));
    assert.equal(app.document.querySelector('#conversation-messages img'), null);
    assert.ok(app.document.getElementById('conversation-message-page').textContent.includes('51–61'));
    await app.ui.click('conversation-messages-prev');
    await app.until(() => app.document.getElementById('conversation-message-page')?.textContent.includes('1–50'));
    assert.ok(app.document.getElementById('conversation-messages').textContent.includes('ข้อความ 0'));
    await app.ui.click('conversation-list-next');
    await app.until(() => app.document.querySelectorAll('[data-conversation-id]').length === 6);
    app.document.getElementById('conversation-search').value = 'U-24';
    await app.ui.submit('conversation-filters');
    await app.until(() => app.document.querySelectorAll('[data-conversation-id]').length === 1);
    assert.ok(app.document.getElementById('conversation-list-page').textContent.includes('1–1'));
    assert.equal(app.document.querySelector('[data-stat="total_messages"]').textContent, '63', 'ตัวกรองห้องไม่เปลี่ยนยอดทั้งร้าน');
    await app.ui.unmount();
    await app.window.testRouter.push('/home');
    await app.window.testRouter.push('/app/shops/shop-coffee/conversations');
    await app.ui.mount();
    await app.until(() => app.document.querySelector('[data-stat="total_messages"]')?.textContent === '63');
    await app.ui.click('conversation-room-ui-024');
    await app.until(() => app.document.getElementById('conversation-messages')?.textContent.includes('<img src=x'));
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

test('refresh recovers from failures and late responses cannot leak the previous shop', async () => {
  const app = await fixture();
  let release;
  try {
    const time = '2026-10-17T00:00:00.000Z';
    app.db.prepare("INSERT INTO shops VALUES ('empty-ui','ร้านว่าง','','','',?,?)").run(time, time);
    app.db.prepare("INSERT INTO shop_memberships VALUES ('empty-ui','user-coffee','owner',?)").run(time);
    await app.ui.mount();
    await app.until(() => app.document.querySelector('[data-stat="total_messages"]')?.textContent === '63');
    app.controls.fail = true;
    await app.ui.click('conversation-refresh');
    await app.until(() => !app.document.getElementById('conversation-load-error').classList.contains('hidden'));
    assert.equal(app.document.querySelector('[data-stat="total_messages"]').textContent, '—');
    assert.ok(app.window.sessionStorage.getItem('smb_access_token'), '503 ไม่ควรล้างบัญชี');
    app.controls.fail = false;
    await app.ui.click('conversation-refresh');
    await app.until(() => app.document.querySelector('[data-stat="total_messages"]')?.textContent === '63');
    app.controls.hold = new Promise(resolve => { release = resolve; });
    await app.ui.click('conversation-refresh');
    await app.window.testRouter.push('/app/shops/empty-ui/conversations');
    await app.until(() => app.document.querySelector('[data-stat="total_messages"]')?.textContent === '0');
    release();
    await app.ui.settle();
    assert.equal(app.document.querySelector('[data-stat="total_messages"]').textContent, '0');
    assert.equal(app.document.querySelectorAll('[data-conversation-id]').length, 0);
    assert.ok(app.document.getElementById('conversation-list').textContent.includes('ไม่พบ'));
    assert.equal(app.document.getElementById('conversation-detail-meta').textContent, '');
    app.controls.hold = null;
    app.controls.fail = true; app.controls.failStatus = 401;
    await app.ui.click('conversation-refresh');
    await app.until(() => app.window.sessionStorage.getItem('smb_access_token') === null);
    assert.ok(!app.document.getElementById('auth-view').classList.contains('hidden'));
    assert.equal(app.document.querySelectorAll('[data-conversation-id]').length, 0);
    assert.deepEqual(app.errors, []);
  } finally { release?.(); await app.close(); }
});

test('polling reflects new messages and bot mode but stops when leaving or hiding the page', async () => {
  const app = await fixture();
  try {
    await app.ui.mount();
    await app.until(() => app.document.querySelector('[data-stat="total_messages"]')?.textContent === '63');
    await app.ui.click('conversation-room-ui-024');
    await app.until(() => app.document.getElementById('conversation-detail-meta').textContent.includes('บอทเปิดทำงาน'));
    app.db.prepare("UPDATE conversations SET bot_mode = 'human' WHERE shop_id = 'shop-coffee' AND id = 'ui-024'").run();
    app.db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?,?)').run('new-live', 'shop-coffee', 'ui-024', 'agent', 'ข้อความใหม่จากแอดมิน', 'user-coffee', '2026-10-17T01:00:00.000Z');
    assert.equal(app.polls.size, 1);
    const [id, tick] = [...app.polls][0]; app.polls.delete(id); await tick();
    await app.until(() => app.document.querySelector('[data-stat="total_messages"]')?.textContent === '64');
    await app.until(() => app.document.getElementById('conversation-messages').textContent.includes('ข้อความใหม่จากแอดมิน'));
    assert.equal(app.document.querySelector('[data-stat="human_conversations"]').textContent, '1');
    assert.ok(app.document.getElementById('conversation-detail-meta').textContent.includes('แอดมินดูแล'));
    Object.defineProperty(app.document, 'hidden', { configurable: true, value: true });
    app.document.dispatchEvent(new app.window.Event('visibilitychange'));
    assert.equal(app.polls.size, 0);
    Object.defineProperty(app.document, 'hidden', { configurable: true, value: false });
    app.document.dispatchEvent(new app.window.Event('visibilitychange'));
    await app.until(() => app.polls.size === 1);
    await app.window.testRouter.push('/app/shops/shop-coffee/settings');
    assert.equal(app.polls.size, 0);
    assert.ok(app.document.getElementById('conversations-section').classList.contains('hidden'));
    await app.ui.unmount();
    assert.equal(app.polls.size, 0);
    await app.ui.mount();
    await app.until(() => app.document.getElementById('settings-name').value === 'บ้านกาแฟ');
    assert.equal(app.polls.size, 0);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});
