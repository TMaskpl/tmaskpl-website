// Testy jednostkowe Workera (node:test, bez dodatkowych zależności).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const env = {
  ASSETS: { fetch: async (req) => new Response(`asset:${new URL(req.url).pathname}`, { status: 200 }) },
};
const call = (url) => worker.fetch(new Request(url), env);

test('www → apex, 301, zachowuje ścieżkę i query', async () => {
  const res = await call('https://www.tmask.pl/llms.txt?a=1');
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), 'https://tmask.pl/llms.txt?a=1');
});

test('http → https, 301', async () => {
  const res = await call('http://tmask.pl/robots.txt');
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), 'https://tmask.pl/robots.txt');
});

test('http + www → jedno przekierowanie na https apex', async () => {
  const res = await call('http://www.tmask.pl/');
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), 'https://tmask.pl/');
});

test('https apex → statyczne pliki z ASSETS', async () => {
  const res = await call('https://tmask.pl/sitemap.xml');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'asset:/sitemap.xml');
});

test('workers.dev i localhost nie są przekierowywane', async () => {
  for (const url of ['https://tmaskpl-website.biuro-9d7.workers.dev/', 'http://127.0.0.1:4321/', 'http://localhost:4321/']) {
    const res = await call(url);
    assert.equal(res.status, 200, url);
  }
});
