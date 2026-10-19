import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fork } from 'node:child_process';
import { createServer } from 'node:net';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createTestDatabase } from '../integration/postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { seedDemo } from '../src/lib/seed.js';
import { createApp } from '../src/lib/app.js';
import { createLineWorker } from '../src/services/worker.js';

process.env.RAG_GENERATOR_URL = ''; process.env.RAG_GENERATOR_TOKEN = '';
process.env.AI_MODE = 'offline';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
test('Chrome production frontend: register, shop, FAQ, LINE, handover, mobile, home and logout', { timeout: 120000 }, async () => {
  const output = resolve(process.env.EVALUATION_REPORT_DIR || 'reports/task11');
  await mkdir(resolve(output, 'screenshots'), { recursive: true });
  const result = { generated_at: new Date().toISOString(), browser: 'Chrome headless', steps: [], page_errors: [], network: [], screenshots: [],
    boundary: 'Production Next frontend; browser API requests forwarded to real HTTP/PostgreSQL test service with injected LINE transport; not live LINE/AI',
    limitations: ['Single Chrome engine and desktop/mobile viewports, not physical devices', 'Basic keyboard activation only, not a full accessibility audit'] };
  let fixture, api, worker, child, browser, page;
  const sent = [];
  const step = name => result.steps.push({ name, passed: true });
  async function screenshot(name) {
    const relative = `screenshots/${name}.png`;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(output, relative), fullPage: true }); result.screenshots.push(relative);
  }
  try {
    fixture = await createTestDatabase(); await migratePostgresql({ config: fixture.config }); await seedDemo(fixture.db);
    worker = createLineWorker(fixture.db, { sendReply: async payload => { sent.push({ role: 'assistant', content: payload.messages[0].text }); }, logErrors: false });
    api = createApp(fixture.db, { worker, logErrors: false, serviceOptions: {
      sendPush: async payload => { sent.push({ role: 'agent', to: payload.to, content: payload.messages[0].text }); },
    } });
    api.listen(0, '127.0.0.1'); await once(api, 'listening');
    const apiBase = `http://127.0.0.1:${api.address().port}`;
    const port = await freePort(), base = `http://127.0.0.1:${port}`;
    child = fork(new URL('../integration/fixtures/production-server.js', import.meta.url), [], { env: {
      ...process.env, NODE_ENV: 'production', PORT: String(port), LINE_WORKER_ENABLED: 'false', APP_MAINTENANCE_MODE: 'false',
      DATABASE_URL: fixture.config.connectionString, DB_SCHEMA: fixture.config.schema, DB_SSL_MODE: 'disable',
    }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const deadline = Date.now() + 15000;
    for (;;) {
      try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* รอเฉพาะ server ของชุดทดสอบ */ }
      if (child.exitCode !== null || Date.now() > deadline) throw new Error('Test frontend did not become healthy');
      await sleep(50);
    }
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/api/v1/**', async route => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: apiBase + url.pathname + url.search });
      result.network.push({ method: route.request().method(), path: url.pathname, status: response.status() });
      await route.fulfill({ response });
    });
    page = await context.newPage(); page.on('pageerror', error => result.page_errors.push(error.message));
    await page.goto(base + '/app?mode=register');
    await page.locator('#register-name').fill('ผู้ทดสอบข้อ 11');
    const email = 'browser-task11@example.test', password = 'BrowserPass!2026';
    await page.locator('#register-email').fill(email); await page.locator('#register-password').fill(password);
    await page.locator('#register-form button[type=submit]').click();
    await page.locator('#create-shop-button').waitFor({ state: 'visible' }); step('register_and_authenticated_dashboard');
    await page.locator('#create-shop-button').click(); await page.locator('#shop-name').fill('ร้านทดสอบข้อ 11');
    await page.locator('#shop-description').fill('ข้อมูลสมมติสำหรับทดสอบ ไม่ใช่ร้านจริง');
    await page.locator('#shop-form button[type=submit]').click();
    await page.waitForURL(/\/app\/shops\/[^/]+\/settings$/);
    const shopId = new URL(page.url()).pathname.split('/')[3];
    await page.locator('#settings-name').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#settings-name').inputValue(), 'ร้านทดสอบข้อ 11'); step('create_shop_and_open_settings');
    await page.locator('#settings-knowledge-tab').click(); await page.locator('#knowledge-add-button').click();
    await page.locator('#knowledge-title').fill('มีไวไฟไหม'); await page.locator('#knowledge-content').fill('มีไวไฟฟรีสำหรับลูกค้าร้านทดสอบ');
    await page.locator('#knowledge-form input[value=published]').check(); await page.locator('#knowledge-form-submit').click();
    await page.waitForFunction(() => document.getElementById('knowledge-published-count')?.textContent === '1'); step('publish_faq');
    await page.locator('#settings-line-tab').click();
    await page.locator('#line-channel-secret').fill('browser-fixture-secret');
    await page.locator('#line-channel-token').fill('browser-fixture-not-a-real-token');
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/line/config') && response.request().method() === 'PUT' && response.status() === 200),
      page.locator('#save-line-btn').click(),
    ]);
    await page.waitForFunction(() => !document.getElementById('line-sim-btn')?.disabled);
    await page.locator('#line-sim-user').fill('U-browser-fixture'); await page.locator('#line-sim-text').fill('มีไวไฟไหม'); await page.locator('#line-sim-btn').click();
    await page.waitForFunction(() => document.getElementById('line-sim-result')?.textContent.includes('มีไวไฟฟรีสำหรับลูกค้า'));
    assert.equal(sent.length, 0); step('simulator_uses_published_faq_without_line_delivery');
    async function webhook(text, eventId = randomUUID()) {
      const raw = JSON.stringify({ events: [{ type: 'message', webhookEventId: eventId, replyToken: 'browser-fixture-reply',
        source: { type: 'user', userId: 'U-browser-fixture' }, message: { type: 'text', id: randomUUID(), text } }] });
      const response = await fetch(apiBase + `/api/v1/shops/${shopId}/line/webhook`, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'x-line-signature': createHmac('sha256', 'browser-fixture-secret').update(raw).digest('base64'),
      }, body: raw }); assert.equal(response.status, 200); await worker.drain(); return eventId;
    }
    await webhook('มีไวไฟไหม'); assert.equal(sent.length, 1); step('signed_line_webhook_to_bot_reply');
    await page.locator('#settings-conversations-tab').click();
    await page.locator('[data-conversation-id]').first().click();
    await page.waitForFunction(() => document.getElementById('conversation-detail-meta')?.textContent.includes('บอทเปิดทำงาน'));
    // ยืนยันว่า activation ด้วยคีย์บอร์ดใช้ handler เดียวกับคลิกจริง
    await page.locator('#conversation-takeover').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('conversation-detail-meta')?.textContent.includes('แอดมินดูแล'));
    await page.locator('#conversation-reply').fill('เจ้าหน้าที่รับเรื่องแล้ว <img src=x>'); await page.locator('#conversation-send').click();
    await page.waitForFunction(() => document.getElementById('conversation-messages')?.textContent.includes('เจ้าหน้าที่รับเรื่องแล้ว'));
    assert.equal(sent.at(-1).to, 'U-browser-fixture'); assert.equal(await page.locator('#conversation-messages img').count(), 0);
    step('keyboard_takeover_and_agent_send_safe_text'); await screenshot('conversations-desktop');
    await page.locator('#conversation-pause').click();
    await page.waitForFunction(() => document.getElementById('conversation-detail-meta')?.textContent.includes('พักบอท'));
    const count = sent.length; await webhook('มีไวไฟไหม'); assert.equal(sent.length, count);
    await page.locator('#conversation-resume').click();
    await page.waitForFunction(() => document.getElementById('conversation-detail-meta')?.textContent.includes('บอทเปิดทำงาน'));
    await webhook('มีไวไฟไหม'); assert.equal(sent.length, count + 1); step('pause_suppresses_bot_and_resume_replies_to_new_message');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await screenshot('conversations-mobile'); step('mobile_390_no_horizontal_overflow');
    await page.locator('#dashboard-view a[aria-label="SMB Chatbot หน้าแรก"]').click();
    await page.waitForURL('**/home');
    await page.waitForFunction(() => document.getElementById('home-primary-action')?.textContent.includes('จัดการร้าน'));
    assert.ok(!(await page.locator('#explore').textContent()).includes('อยู่ในแผนพัฒนา'));
    await screenshot('home-mobile-signed-in'); step('logo_returns_home_with_signed_in_manage_button');
    await page.locator('#home-primary-action').click();
    await page.locator('#create-shop-button').waitFor({ state: 'visible' });
    await page.locator('#shop-list button').first().waitFor({ state: 'visible' });
    assert.equal(await page.locator('#shop-list button').count(), 1); step('home_round_trip_preserves_session_and_tenant_shop_list');
    await page.locator('#logout-button').click(); await page.locator('#login-email').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => sessionStorage.getItem('smb_access_token')), null);
    await page.locator('#login-email').fill(email); await page.locator('#login-password').fill(password);
    await page.locator('#login-form button[type=submit]').click(); await page.locator('#create-shop-button').waitFor({ state: 'visible' });
    step('logout_revokes_session_and_relogin_works');
    assert.deepEqual(result.page_errors, []); result.passed = true;
  } catch (error) {
    result.passed = false; result.failure = error.message;
    if (page && !page.isClosed()) await screenshot('failure').catch(() => {});
    throw error;
  } finally {
    await browser?.close();
    if (child && child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit');
      if (process.platform === 'win32') child.send({ signal: 'SIGTERM' }); else child.kill('SIGTERM');
      let timer; await Promise.race([exit, new Promise(resolve => { timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 18000); })]); clearTimeout(timer);
    }
    if (api) { await new Promise(resolve => api.close(resolve)); await api.drain(); }
    await worker?.stop(); await fixture?.dispose();
    await writeFile(resolve(output, 'browser-results.json'), JSON.stringify(result, null, 2) + '\n');
    console.log('TASK11_BROWSER', JSON.stringify({ passed: result.passed, steps: result.steps.length, page_errors: result.page_errors.length, screenshots: result.screenshots }));
  }
});
