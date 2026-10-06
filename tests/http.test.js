// Testy wspólnych helperów HTTP Workera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { json, readJsonRequest, clientIp, csv, MAX_BODY_BYTES } from '../worker/http.js';

const env = { ALLOWED_ORIGINS: 'https://tmask.pl, http://127.0.0.1:4321' };
const req = ({ method = 'POST', origin = 'https://tmask.pl', type = 'application/json', body = '{}', ip } = {}) => {
  const headers = { 'content-type': type };
  if (origin) headers.origin = origin;
  if (ip) headers['cf-connecting-ip'] = ip;
  return new Request('https://tmask.pl/api/lead', { method, headers, body: method === 'GET' ? undefined : body });
};

test('json(): status, body, nagłówki no-store', async () => {
  const res = json(418, { a: 1 }, { 'x-test': '1' });
  assert.equal(res.status, 418);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-test'), '1');
  assert.deepEqual(await res.json(), { a: 1 });
});

test('csv(): dzieli, przycina, pomija puste', () => {
  assert.deepEqual(csv(' a, b ,,c '), ['a', 'b', 'c']);
  assert.deepEqual(csv(''), []);
  assert.deepEqual(csv(undefined), []);
});

test('clientIp(): CF-Connecting-IP albo "unknown"', () => {
  assert.equal(clientIp(req({ ip: '203.0.113.7' })), '203.0.113.7');
  assert.equal(clientIp(req()), 'unknown');
});

test('readJsonRequest(): poprawne żądanie zwraca body', async () => {
  const r = await readJsonRequest(req({ body: '{"x":1}' }), env);
  assert.deepEqual(r.body, { x: 1 });
});

test('readJsonRequest(): drugi dozwolony origin z listy', async () => {
  const r = await readJsonRequest(req({ origin: 'http://127.0.0.1:4321' }), env);
  assert.deepEqual(r.body, {});
});

const expectStatus = async (request, status) => {
  const r = await readJsonRequest(request, env);
  assert.ok(r.response, 'oczekiwano odpowiedzi błędu');
  assert.equal(r.response.status, status);
};

test('readJsonRequest(): metoda inna niż POST → 405', () => expectStatus(req({ method: 'GET' }), 405));
test('readJsonRequest(): obcy Origin → 403', () => expectStatus(req({ origin: 'https://evil.example' }), 403));
test('readJsonRequest(): brak Origin → 403', () => expectStatus(req({ origin: null }), 403));
test('readJsonRequest(): zły Content-Type → 415', () => expectStatus(req({ type: 'text/plain' }), 415));
test('readJsonRequest(): body > 10 KB → 413', () =>
  expectStatus(req({ body: JSON.stringify({ a: 'x'.repeat(MAX_BODY_BYTES) }) }), 413));
test('readJsonRequest(): nie-JSON → 400', () => expectStatus(req({ body: '{nie json' }), 400));
test('readJsonRequest(): tablica jako body → 400', () => expectStatus(req({ body: '[1,2]' }), 400));
test('readJsonRequest(): null jako body → 400', () => expectStatus(req({ body: 'null' }), 400));
