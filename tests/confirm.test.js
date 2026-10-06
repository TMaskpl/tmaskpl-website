import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleConfirm } from '../worker/confirm.js';
import { signToken } from '../worker/token.js';
import { makeEnv, fakeFetch, apiRequest } from './helpers.js';

const LEAD_ID = '3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f';
const NOW = new Date('2026-10-06T12:00:00.000Z');
const nowSec = Math.floor(NOW.getTime() / 1000);
const tokenAt = async (sec = nowSec) => (await signToken(LEAD_ID, 'hmac-secret', sec)).token;
const send = async (token, { env = makeEnv(), fetch = fakeFetch() } = {}) =>
  handleConfirm(apiRequest('/api/lead/confirm', { token }), env, { fetch, now: () => NOW });

test('confirmed → 200 i payload {lead_id, ts} do tmask-lead-confirm', async () => {
  const fetch = fakeFetch({ n8n: { status: 200, body: { status: 'confirmed' } } });
  const res = await send(await tokenAt(), { fetch });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'confirmed' });
  const [call] = fetch.n8nCalls();
  assert.equal(call.url, 'https://n8n.example/webhook/tmask-lead-confirm');
  assert.equal(call.init.headers['x-tmask-auth'], 'n8n-token');
  assert.deepEqual(JSON.parse(call.init.body), { lead_id: LEAD_ID, ts: '2026-10-06T12:00:00.000Z' });
});

test('already → 200 {status:"already"}', async () => {
  const res = await send(await tokenAt(), { fetch: fakeFetch({ n8n: { status: 200, body: { status: 'already' } } }) });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'already' });
});

test('zły token → 400 invalid, bez n8n', async () => {
  const fetch = fakeFetch();
  const res = await send('abc.def.ghi', { fetch });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { status: 'invalid' });
  assert.equal(fetch.n8nCalls().length, 0);
});

test('wygasły → 410 expired, bez n8n', async () => {
  const fetch = fakeFetch();
  const res = await send(await tokenAt(nowSec - 49 * 3600), { fetch });
  assert.equal(res.status, 410);
  assert.deepEqual(await res.json(), { status: 'expired' });
  assert.equal(fetch.n8nCalls().length, 0);
});

test('n8n 404 → 404 not_found', async () => {
  const res = await send(await tokenAt(), { fetch: fakeFetch({ n8n: { status: 404, body: { status: 'not_found' } } }) });
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { status: 'not_found' });
});

test('n8n 404 z body "webhook not registered" (workflow nieaktywny) → 502 error', async () => {
  const res = await send(await tokenAt(), { fetch: fakeFetch({ n8n: { status: 404, body: { code: 404, message: 'The requested webhook "tmask-lead-confirm" is not registered.' } } }) });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { status: 'error' });
});

for (const [label, n8n] of [['500', { status: 500, body: {} }], ['200 z nieznanym body', { status: 200, body: { foo: 1 } }], ['200 nie-JSON', { status: 200, body: null }], ['sieć', 'down']]) {
  test(`n8n ${label} → 502 error`, async () => {
    const res = await send(await tokenAt(), { fetch: fakeFetch({ n8n }) });
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { status: 'error' });
  });
}

test('rate limit → 429', async () => {
  const env = makeEnv({ CONFIRM_LIMIT: { limit: async () => ({ success: false }) } });
  const res = await send(await tokenAt(), { env });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '60');
});
