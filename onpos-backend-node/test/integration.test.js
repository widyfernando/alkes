const test = require('node:test');
const assert = require('node:assert/strict');

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5000';
const username = process.env.TEST_USERNAME || 'admin123';
const password = process.env.TEST_PASSWORD || 'admin123';

test('health endpoint tersedia dan security headers aktif', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 1);
  assert.ok(response.headers.get('x-content-type-options'));
  assert.ok(response.headers.get('ratelimit'));
});

test('login valid menghasilkan token dan token membuka dashboard', async () => {
  const loginResponse = await fetch(`${baseUrl}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const login = await loginResponse.json();
  assert.equal(login.status, 1);
  assert.ok(login.token);

  const dashboardResponse = await fetch(`${baseUrl}/dashboard/summary`, { headers: { authorization: `Bearer ${login.token}` } });
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboardResponse.status, 200);
  assert.ok(dashboard.inventory);
  assert.ok(dashboard.sales);
});

test('token tidak valid ditolak tanpa membocorkan detail internal', async () => {
  const response = await fetch(`${baseUrl}/dashboard/summary`, { headers: { authorization: 'Bearer token-rusak' } });
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.status, 0);
  assert.match(body.message, /token/i);
});

test('pembatalan transaksi memerlukan alasan valid dan order yang tersedia', async () => {
  const loginResponse = await fetch(`${baseUrl}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const login = await loginResponse.json();
  const headers = { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' };

  const invalidReason = await fetch(`${baseUrl}/sales/orders/ORDER-TIDAK-ADA/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: 'x' }) });
  assert.equal(invalidReason.status, 400);

  const missingOrder = await fetch(`${baseUrl}/sales/orders/ORDER-TIDAK-ADA/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: 'Pengujian order tidak tersedia' }) });
  const missingBody = await missingOrder.json();
  assert.equal(missingOrder.status, 404);
  assert.match(missingBody.message, /tidak ditemukan/i);
});
