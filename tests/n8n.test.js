import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callN8n, N8N_TIMEOUT_MS } from '../worker/n8n.js';

test('timeout domyślny 10 s', () => assert.equal(N8N_TIMEOUT_MS, 10_000));

test('POST JSON z nagłówkiem X-Tmask-Auth na base/path (bez podwójnego /)', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ ok: true }); };
  const r = await callN8n({ base: 'https://n8n.example/webhook/', path: 'tmask-lead-new', authToken: 'tok', payload: { a: 1 }, fetchImpl });
  assert.deepEqual(r, { status: 200, body: { ok: true } });
  assert.equal(calls[0].url, 'https://n8n.example/webhook/tmask-lead-new');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.equal(calls[0].init.headers['x-tmask-auth'], 'tok');
  assert.deepEqual(JSON.parse(calls[0].init.body), { a: 1 });
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test('status ≠ 2xx przekazany, body nie-JSON → null', async () => {
  const r = await callN8n({ base: 'https://n8n.example/webhook', path: 'p', authToken: 't', payload: {}, fetchImpl: async () => new Response('err', { status: 500 }) });
  assert.deepEqual(r, { status: 500, body: null });
});

test('błąd sieci → status 0', async () => {
  const r = await callN8n({ base: 'https://n8n.example/webhook', path: 'p', authToken: 't', payload: {}, fetchImpl: async () => { throw new Error('x'); } });
  assert.deepEqual(r, { status: 0, body: null });
});

test('timeout → status 0', async () => {
  const fetchImpl = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  const r = await callN8n({ base: 'https://n8n.example/webhook', path: 'p', authToken: 't', payload: {}, fetchImpl, timeoutMs: 20 });
  assert.deepEqual(r, { status: 0, body: null });
});
