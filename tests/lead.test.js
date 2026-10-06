import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleLead } from '../worker/lead.js';
import { verifyToken } from '../worker/token.js';
import { CONSENT_TEXT } from '../worker/validate.js';
import { makeEnv, fakeFetch, apiRequest } from './helpers.js';

const LEAD_ID = '3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f';
const NOW = new Date('2026-10-06T12:00:00.000Z');
const deps = (fetch) => ({ fetch, now: () => NOW, uuid: () => LEAD_ID });
const body = (over = {}) => ({
  nazwa: 'Jan Kowalski', email: 'jan@example.com', telefon: '', rodzaj_firmy: 'Biuro',
  zakres_wsparcia: 'Potrzebuję pomocy z siecią w biurze.', zgoda_rodo: true, turnstile_token: 'tok', website: '', ...over,
});
const send = (b, { env = makeEnv(), fetch = fakeFetch(), opts } = {}) =>
  handleLead(apiRequest('/api/lead', b, opts), env, deps(fetch));

test('sukces → 202 {ok:true} i dokładny payload do n8n', async () => {
  const fetch = fakeFetch();
  const res = await send(body(), { fetch });
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { ok: true });
  const [call] = fetch.n8nCalls();
  assert.equal(call.url, 'https://n8n.example/webhook/tmask-lead-new');
  assert.equal(call.init.headers['x-tmask-auth'], 'n8n-token');
  const p = JSON.parse(call.init.body);
  assert.equal(p.lead_id, LEAD_ID);
  assert.equal(p.ts, '2026-10-06T12:00:00.000Z');
  assert.equal(p.expires_at, '2026-10-08T12:00:00.000Z');
  assert.equal(p.zgoda_tresc, CONSENT_TEXT);
  assert.equal(p.zrodlo, 'tmask.pl');
  assert.deepEqual(
    { nazwa: p.nazwa, email: p.email, telefon: p.telefon, rodzaj_firmy: p.rodzaj_firmy, zakres_wsparcia: p.zakres_wsparcia },
    { nazwa: 'Jan Kowalski', email: 'jan@example.com', telefon: '', rodzaj_firmy: 'Biuro', zakres_wsparcia: 'Potrzebuję pomocy z siecią w biurze.' },
  );
  assert.ok(!('turnstile_token' in p) && !('website' in p) && !('zgoda_rodo' in p));
  const url = new URL(p.confirm_url);
  assert.equal(`${url.origin}${url.pathname}`, 'https://tmask.pl/potwierdz');
  const v = await verifyToken(url.searchParams.get('t'), 'hmac-secret', Math.floor(NOW.getTime() / 1000));
  assert.deepEqual(v, { status: 'valid', leadId: LEAD_ID });
});

test('obcy Origin → 403 i brak wywołań sieci', async () => {
  const fetch = fakeFetch();
  const res = await send(body(), { fetch, opts: { origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
  assert.equal(fetch.calls.length, 0);
});

test('rate limit → 429 z Retry-After: 60, klucz = IP', async () => {
  let key;
  const env = makeEnv({ LEAD_LIMIT: { limit: async (o) => { key = o.key; return { success: false }; } } });
  const res = await send(body(), { env });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '60');
  assert.equal(key, '203.0.113.7');
});

test('honeypot wypełniony → 202, ale bez Turnstile i bez n8n', async () => {
  const fetch = fakeFetch();
  const res = await send(body({ website: 'http://spam.example' }), { fetch });
  assert.equal(res.status, 202);
  assert.equal(fetch.calls.length, 0);
});

test('błędy walidacji → 400 z errors, bez Turnstile i n8n', async () => {
  const fetch = fakeFetch();
  const res = await send(body({ email: 'zly', zgoda_rodo: false }), { fetch });
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.equal(j.ok, false);
  assert.ok(j.errors.email && j.errors.zgoda_rodo);
  assert.equal(fetch.calls.length, 0);
});

test('Turnstile odrzucony → 400 errors.turnstile, bez n8n', async () => {
  const fetch = fakeFetch({ turnstile: { success: false } });
  const res = await send(body(), { fetch });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.turnstile);
  assert.equal(fetch.n8nCalls().length, 0);
});

test('Turnstile: hostname i action z env', async () => {
  const fetch = fakeFetch({ turnstile: { success: true, hostname: 'example.com', action: '' } });
  const env = makeEnv({ TURNSTILE_HOSTNAMES: 'example.com', TURNSTILE_ACTION: '' });
  assert.equal((await send(body(), { env, fetch })).status, 202);
});

for (const [label, n8n] of [['500', { status: 500, body: {} }], ['404', { status: 404, body: {} }], ['sieć', 'down']]) {
  test(`n8n ${label} → 502 bez szczegółów`, async () => {
    const res = await send(body(), { fetch: fakeFetch({ n8n }) });
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { ok: false });
  });
}

test('n8n 200 {}, pusty body → 502 bez szczegółów', async () => {
  const res = await send(body(), { fetch: fakeFetch({ n8n: { status: 200, body: null } }) });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { ok: false });
});

test('n8n 200 {ok:false} → 502 bez szczegółów', async () => {
  const res = await send(body(), { fetch: fakeFetch({ n8n: { status: 200, body: { ok: false } } }) });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { ok: false });
});
