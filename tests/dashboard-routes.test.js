import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDashboardRoute, shopRoute } from '../src/utils/dashboardRoutes.js';

test('dashboard routes keep shop and tab identity across direct URLs', () => {
  assert.deepEqual(parseDashboardRoute('/app'), { shopId: null, tab: null });
  assert.deepEqual(parseDashboardRoute('/app/'), { shopId: null, tab: null });

  for (const tab of ['settings', 'knowledge', 'line', 'conversations']) {
    const url = shopRoute('ร้าน กาแฟ', tab);
    assert.deepEqual(parseDashboardRoute(`${url}?from=menu`), {
      shopId: 'ร้าน กาแฟ',
      tab,
    });
  }
});

test('dashboard routes reject unknown screens and malformed shop IDs', () => {
  for (const url of [
    '/app/shops/shop-coffee',
    '/app/shops/shop-coffee/unknown',
    '/app/shops/%2F/line',
    '/app/shops/%ZZ/settings',
    '/app/nope',
  ]) {
    assert.equal(parseDashboardRoute(url), null);
  }
  assert.throws(() => shopRoute('shop-coffee', 'unknown'));
});
