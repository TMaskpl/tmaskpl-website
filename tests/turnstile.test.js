import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyTurnstile, SITEVERIFY_URL } from '../worker/turnstile.js';

const reply = (data, status = 200) => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify(data), { status }); };
  return { fetchImpl, calls };
};
const base = { token: 'tok', ip: '203.0.113.7', secret: 'sek', hostnames: ['tmask.pl'], action: 'lead' };

test('sukces → true; wysyła secret, response, remoteip na SITEVERIFY_URL', async () => {
  const { fetchImpl, calls } = reply({ success: true, hostname: 'tmask.pl', action: 'lead' });
  assert.equal(await verifyTurnstile({ ...base, fetchImpl }), true);
  assert.equal(calls[0].url, SITEVERIFY_URL);
  assert.equal(calls[0].init.method, 'POST');
  const form = calls[0].init.body;
  assert.equal(form.get('secret'), 'sek');
  assert.equal(form.get('response'), 'tok');
  assert.equal(form.get('remoteip'), '203.0.113.7');
});

test('success=false → false', async () => {
  assert.equal(await verifyTurnstile({ ...base, ...reply({ success: false }) }), false);
});
test('zły hostname → false', async () => {
  assert.equal(await verifyTurnstile({ ...base, ...reply({ success: true, hostname: 'evil.example', action: 'lead' }) }), false);
});
test('zła akcja → false', async () => {
  assert.equal(await verifyTurnstile({ ...base, ...reply({ success: true, hostname: 'tmask.pl', action: 'inna' }) }), false);
});
test('puste hostnames i action → bez tych sprawdzeń', async () => {
  const r = reply({ success: true, hostname: 'example.com', action: '' });
  assert.equal(await verifyTurnstile({ ...base, hostnames: [], action: '', ...r }), true);
});
test('brak tokenu lub za długi → false bez wywołania sieci', async () => {
  const r = reply({ success: true });
  assert.equal(await verifyTurnstile({ ...base, token: '', ...r }), false);
  assert.equal(await verifyTurnstile({ ...base, token: 'x'.repeat(2049), ...r }), false);
  assert.equal(r.calls.length, 0);
});
test('błąd sieci / HTTP 500 / nie-JSON → false', async () => {
  assert.equal(await verifyTurnstile({ ...base, fetchImpl: async () => { throw new Error('net'); } }), false);
  assert.equal(await verifyTurnstile({ ...base, ...reply({}, 500) }), false);
  assert.equal(await verifyTurnstile({ ...base, fetchImpl: async () => new Response('<html>') }), false);
});
