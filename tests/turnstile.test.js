import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyTurnstile, SITEVERIFY_URL } from '../worker/turnstile.js';

const reply = (data, status = 200) => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify(data), { status }); };
  return { fetchImpl, calls };
};
const base = { token: 'tok', ip: '203.0.113.7', secret: 'sek', hostnames: ['tmask.pl'], action: 'lead' };

test('sukces → ok; wysyła secret, response, remoteip na SITEVERIFY_URL', async () => {
  const { fetchImpl, calls } = reply({ success: true, hostname: 'tmask.pl', action: 'lead' });
  assert.deepEqual(await verifyTurnstile({ ...base, fetchImpl }), { ok: true, reason: '' });
  assert.equal(calls[0].url, SITEVERIFY_URL);
  assert.equal(calls[0].init.method, 'POST');
  const form = calls[0].init.body;
  assert.equal(form.get('secret'), 'sek');
  assert.equal(form.get('response'), 'tok');
  assert.equal(form.get('remoteip'), '203.0.113.7');
});

test('success=false → not_success (+ error-codes)', async () => {
  assert.deepEqual(await verifyTurnstile({ ...base, ...reply({ success: false }) }), { ok: false, reason: 'not_success' });
  assert.deepEqual(
    await verifyTurnstile({ ...base, ...reply({ success: false, 'error-codes': ['invalid-input-secret'] }) }),
    { ok: false, reason: 'not_success:invalid-input-secret' },
  );
  assert.deepEqual(
    await verifyTurnstile({ ...base, ...reply({ success: false, 'error-codes': ['a', 'b'] }) }),
    { ok: false, reason: 'not_success:a,b' },
  );
});
test('zły hostname → hostname_mismatch', async () => {
  assert.deepEqual(await verifyTurnstile({ ...base, ...reply({ success: true, hostname: 'evil.example', action: 'lead' }) }), { ok: false, reason: 'hostname_mismatch' });
});
test('zła akcja → action_mismatch', async () => {
  assert.deepEqual(await verifyTurnstile({ ...base, ...reply({ success: true, hostname: 'tmask.pl', action: 'inna' }) }), { ok: false, reason: 'action_mismatch' });
});
test('puste hostnames i action → bez tych sprawdzeń', async () => {
  const r = reply({ success: true, hostname: 'example.com', action: '' });
  assert.deepEqual(await verifyTurnstile({ ...base, hostnames: [], action: '', ...r }), { ok: true, reason: '' });
});
test('brak tokenu lub za długi → missing_token bez wywołania sieci', async () => {
  const r = reply({ success: true });
  assert.deepEqual(await verifyTurnstile({ ...base, token: '', ...r }), { ok: false, reason: 'missing_token' });
  assert.deepEqual(await verifyTurnstile({ ...base, token: 'x'.repeat(2049), ...r }), { ok: false, reason: 'missing_token' });
  assert.equal(r.calls.length, 0);
});
test('błąd sieci / HTTP 500 / nie-JSON', async () => {
  assert.deepEqual(await verifyTurnstile({ ...base, fetchImpl: async () => { throw new Error('net'); } }), { ok: false, reason: 'network' });
  assert.deepEqual(await verifyTurnstile({ ...base, ...reply({}, 500) }), { ok: false, reason: 'http_500' });
  assert.deepEqual(await verifyTurnstile({ ...base, fetchImpl: async () => new Response('<html>') }), { ok: false, reason: 'network' });
});
