// @ts-check
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { readFileSync } from 'node:fs';

const REFERENCE = 'http://localhost:4322/original.html';
const ASTRO = 'http://127.0.0.1:4321/';

/** Czeka aż boot się skończy i terminal przestanie dopisywać linie. */
async function settle(page) {
  await expect(page.locator('#cmd-input')).toBeEnabled({ timeout: 15_000 });
  let prev = -1;
  for (;;) {
    const n = await page.locator('#terminal .line').count();
    if (n === prev) return;
    prev = n;
    await page.waitForTimeout(400);
  }
}

async function open(browser, testInfo, url) {
  const ctx = await browser.newContext(testInfo.project.use);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await settle(page);
  return { page, errors };
}

async function snapshot(page) {
  const html = await page.locator('#terminal').innerHTML();
  const png = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  return { html, png };
}

function diffPixels(a, b) {
  const A = PNG.sync.read(a);
  const B = PNG.sync.read(b);
  expect([B.width, B.height], 'wymiary screenshotu').toEqual([A.width, A.height]);
  return pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: 0 });
}

async function compare(ref, neu, label) {
  const r = await snapshot(ref.page);
  const n = await snapshot(neu.page);
  expect(n.html, `${label}: DOM terminala`).toBe(r.html);
  expect(diffPixels(r.png, n.png), `${label}: różne piksele`).toBe(0);
}

/** Wykonuje tę samą akcję na obu stronach i porównuje wynik. */
async function both(ref, neu, label, action) {
  await action(ref.page);
  await action(neu.page);
  await settle(ref.page);
  await settle(neu.page);
  await compare(ref, neu, label);
}

const typed = (cmd) => async (page) => {
  await page.locator('#cmd-input').fill(cmd);
  await page.locator('#cmd-input').press('Enter');
};

test('ekran po boot jest identyczny', async ({ browser }, testInfo) => {
  const ref = await open(browser, testInfo, REFERENCE);
  const neu = await open(browser, testInfo, ASTRO);
  await compare(ref, neu, 'boot');
  expect(neu.errors).toEqual(ref.errors);
});

for (const cmd of ['help', 'whoami', 'skills', 'projects', 'contact', 'social', 'ls', 'cat cv.txt', 'nieznana-komenda', 'clear']) {
  test(`komenda wpisana: ${cmd}`, async ({ browser }, testInfo) => {
    const ref = await open(browser, testInfo, REFERENCE);
    const neu = await open(browser, testInfo, ASTRO);
    await both(ref, neu, cmd, typed(cmd));
  });
}

for (const cmd of ['whoami', 'skills', 'projects', 'contact', 'social', 'help', 'clear']) {
  test(`szybka komenda (pill): ${cmd}`, async ({ browser }, testInfo) => {
    const ref = await open(browser, testInfo, REFERENCE);
    const neu = await open(browser, testInfo, ASTRO);
    await both(ref, neu, `pill ${cmd}`, (p) => p.locator('.pill', { hasText: new RegExp(`^${cmd}$`) }).click());
  });
}

test('historia (ArrowUp) i Tab completion', async ({ browser }, testInfo) => {
  const ref = await open(browser, testInfo, REFERENCE);
  const neu = await open(browser, testInfo, ASTRO);
  await both(ref, neu, 'whoami', typed('whoami'));
  for (const s of [ref, neu]) await s.page.locator('#cmd-input').press('ArrowUp');
  expect(await neu.page.locator('#cmd-input').inputValue()).toBe(await ref.page.locator('#cmd-input').inputValue());
  for (const s of [ref, neu]) {
    await s.page.locator('#cmd-input').fill('sk');
    await s.page.locator('#cmd-input').press('Tab');
  }
  expect(await neu.page.locator('#cmd-input').inputValue()).toBe(await ref.page.locator('#cmd-input').inputValue());
});

test('treść SEO i head zgodne z oryginałem', async ({ browser }, testInfo) => {
  const ref = await open(browser, testInfo, REFERENCE);
  const neu = await open(browser, testInfo, ASTRO);
  for (const sel of ['main.sr-only', 'script[type="application/ld+json"]']) {
    expect(await neu.page.locator(sel).innerHTML(), sel).toBe(await ref.page.locator(sel).innerHTML());
  }
  expect(await neu.page.title()).toBe(await ref.page.title());
});

for (const file of ['robots.txt', 'llms.txt', 'sitemap.xml']) {
  test(`plik statyczny ${file} serwowany bez zmian`, async ({ request }) => {
    const res = await request.get(`${ASTRO}${file}`);
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe(readFileSync(`public/${file}`, 'utf8'));
  });
}
