import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken, TOKEN_TTL_SECONDS } from '../worker/token.js';

const SECRET = 'test-secret';
const ID = '3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f';
const NOW = 1_800_000_000;

test('TTL = 48 h', () => assert.equal(TOKEN_TTL_SECONDS, 48 * 3600));

test('round-trip: podpisany token jest ważny i zwraca lead_id', async () => {
  const { token, exp } = await signToken(ID, SECRET, NOW);
  assert.equal(exp, NOW + TOKEN_TTL_SECONDS);
  assert.match(token, /^[A-Za-z0-9_-]+\.\d+\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(await verifyToken(token, SECRET, NOW + 10), { status: 'valid', leadId: ID });
});

test('token nie zawiera lead_id jawnym tekstem ani danych osobowych', async () => {
  const { token } = await signToken(ID, SECRET, NOW);
  assert.ok(!token.includes(ID));
});

test('wygasły → expired (dokładnie na granicy też)', async () => {
  const { token, exp } = await signToken(ID, SECRET, NOW);
  assert.deepEqual(await verifyToken(token, SECRET, exp), { status: 'expired' });
  assert.deepEqual(await verifyToken(token, SECRET, exp + 1), { status: 'expired' });
});

test('inny sekret → invalid', async () => {
  const { token } = await signToken(ID, SECRET, NOW);
  assert.deepEqual(await verifyToken(token, 'inny', NOW), { status: 'invalid' });
});

test('podmieniony exp lub lead_id → invalid', async () => {
  const { token } = await signToken(ID, SECRET, NOW);
  const [id, exp, sig] = token.split('.');
  assert.deepEqual(await verifyToken(`${id}.${Number(exp) + 1000}.${sig}`, SECRET, NOW), { status: 'invalid' });
  const other = (await signToken('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', SECRET, NOW)).token.split('.')[0];
  assert.deepEqual(await verifyToken(`${other}.${exp}.${sig}`, SECRET, NOW), { status: 'invalid' });
});

// Review Focus 5: link z maila ucięty / z doklejonymi znakami
test('śmieci, ucięcia, doklejone znaki → invalid bez wyjątku', async () => {
  const { token } = await signToken(ID, SECRET, NOW);
  for (const bad of [undefined, null, 42, '', 'abc', 'a.b', 'a.b.c.d', token.slice(0, -5), `${token}xyz`, `${token} `, token.replace('.', '. '), 'x'.repeat(600), '!!!.123.???']) {
    assert.deepEqual(await verifyToken(bad, SECRET, NOW), { status: 'invalid' }, String(bad).slice(0, 40));
  }
});

test('lead_id niebędący UUID → invalid nawet z poprawnym podpisem', async () => {
  const { token } = await signToken('nie-uuid', SECRET, NOW);
  assert.deepEqual(await verifyToken(token, SECRET, NOW), { status: 'invalid' });
});
