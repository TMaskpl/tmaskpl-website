// @ts-check
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { readFileSync, writeFileSync } from 'node:fs';

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
  // Nowa funkcja formularza (pill `hire`, linie w terminalu) nie istnieje w oryginale — porównujemy resztę
  await page.evaluate(() => document.querySelectorAll('[data-hire], #terminal .line.hire-only').forEach((el) => el.remove()));
  const html = await page.locator('#terminal').innerHTML();
  const png = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  return { html, png };
}

// Tolerancja na niedeterministyczny antyaliasing (Chromium na Linuksie, narożniki pilli):
// dopuszczamy do MAX_NOISY_PIXELS pikseli różniących się o <= MAX_CHANNEL_DELTA na kanał.
// Każda realna zmiana (np. kolor o 1 jednostkę) dotyka tysięcy pikseli i jest wykrywana.
const MAX_CHANNEL_DELTA = 2;
const MAX_NOISY_PIXELS = 100;

async function assertSamePixels(a, b, label) {
  const A = PNG.sync.read(a);
  const B = PNG.sync.read(b);
  expect([B.width, B.height], `${label}: wymiary screenshotu`).toEqual([A.width, A.height]);
  const diff = new PNG({ width: A.width, height: A.height });
  const differing = pixelmatch(A.data, B.data, diff.data, A.width, A.height, { threshold: 0 });
  let maxDelta = 0;
  for (let i = 0; i < A.data.length; i++) maxDelta = Math.max(maxDelta, Math.abs(A.data[i] - B.data[i]));
  const ok = maxDelta <= MAX_CHANNEL_DELTA && differing <= MAX_NOISY_PIXELS;
  if (!ok) {
    const info = test.info();
    writeFileSync(info.outputPath('reference.png'), a);
    writeFileSync(info.outputPath('astro.png'), b);
    writeFileSync(info.outputPath('diff.png'), PNG.sync.write(diff));
  }
  expect(ok, `${label}: różne piksele (${differing} px, max delta ${maxDelta})`).toBe(true);
}

async function compare(ref, neu, label) {
  const r = await snapshot(ref.page);
  const n = await snapshot(neu.page);
  expect(n.html, `${label}: DOM terminala`).toBe(r.html);
  await assertSamePixels(r.png, n.png, label);
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
    await both(ref, neu, `pill ${cmd}`, async (p) => {
      await p.locator('.pill', { hasText: new RegExp(`^${cmd}$`) }).click();
      // .pill:hover ma transition 0.15s — zdejmujemy hover, settle() czeka aż przejście się skończy
      await p.mouse.move(0, 0);
    });
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

test('help zawiera hire, a pill hire jest ostatni', async ({ page }) => {
  await page.goto(ASTRO);
  await settle(page);
  await page.locator('#cmd-input').fill('help');
  await page.locator('#cmd-input').press('Enter');
  await settle(page);
  await expect(page.locator('#terminal .line.hire-only')).toContainText('hire');
  await expect(page.locator('.pills .pill').last()).toHaveText('hire');
});
