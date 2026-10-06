// @ts-check
import { test, expect } from '@playwright/test';

const PAGE = 'http://127.0.0.1:4321/potwierdz';

async function open(page, query, handler) {
  const requests = [];
  await page.route('**/api/lead/confirm', async (route) => {
    requests.push(route.request().postDataJSON());
    await handler(route, requests.length);
  });
  await page.goto(`${PAGE}${query}`);
  return requests;
}
const reply = (status, body) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const visible = (page, state) => page.locator(`[data-state~="${state}"]`).first();

test('meta: noindex i no-referrer; token znika z paska adresu', async ({ page }) => {
  await open(page, '?t=abc.123.def', reply(200, { status: 'confirmed' }));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  expect(new URL(page.url()).search).toBe('');
});

test('nic nie jest wysyłane bez kliknięcia (skanery linków)', async ({ page }) => {
  const requests = await open(page, '?t=abc.123.def', reply(200, { status: 'confirmed' }));
  await page.waitForTimeout(500);
  expect(requests).toHaveLength(0);
  await expect(page.getByRole('button', { name: '[ potwierdzam ]' })).toBeVisible();
});

for (const [label, status, body, state] of [
  ['confirmed', 200, { status: 'confirmed' }, 'confirmed'],
  ['already', 200, { status: 'already' }, 'already'],
  ['expired', 410, { status: 'expired' }, 'expired'],
  ['invalid', 400, { status: 'invalid' }, 'invalid'],
  ['not_found', 404, { status: 'not_found' }, 'invalid'],
  ['error 502', 502, { status: 'error' }, 'error'],
  ['error 429', 429, { status: 'error' }, 'error'],
]) {
  test(`stan ${label}`, async ({ page }) => {
    const requests = await open(page, '?t=abc.123.def', reply(status, body));
    await page.getByRole('button', { name: '[ potwierdzam ]' }).click();
    await expect(visible(page, state)).toBeVisible();
    expect(requests).toEqual([{ token: 'abc.123.def' }]);
  });
}

test('błąd → przycisk wraca i ponowienie działa', async ({ page }) => {
  await open(page, '?t=abc.123.def', (route, n) => (n === 1 ? reply(502, { status: 'error' })(route) : reply(200, { status: 'confirmed' })(route)));
  await page.getByRole('button', { name: '[ potwierdzam ]' }).click();
  await expect(visible(page, 'error')).toBeVisible();
  await page.getByRole('button', { name: '[ potwierdzam ]' }).click();
  await expect(visible(page, 'confirmed')).toBeVisible();
});

test('brak tokenu → od razu stan invalid, bez przycisku', async ({ page }) => {
  const requests = await open(page, '', reply(200, { status: 'confirmed' }));
  await expect(visible(page, 'invalid')).toBeVisible();
  await expect(page.getByRole('button', { name: '[ potwierdzam ]' })).toBeHidden();
  expect(requests).toHaveLength(0);
});

// Review Focus 3: podwójne kliknięcie
test('podwójne kliknięcie → jedno żądanie', async ({ page }) => {
  const requests = await open(page, '?t=abc.123.def', async (route) => { await new Promise((r) => setTimeout(r, 400)); await reply(200, { status: 'confirmed' })(route); });
  const btn = page.getByRole('button', { name: '[ potwierdzam ]' });
  await btn.click();
  await btn.click({ force: true, timeout: 1000 }).catch(() => {});
  await expect(visible(page, 'confirmed')).toBeVisible();
  expect(requests).toHaveLength(1);
});

// Review Focus 5: token z doklejonymi spacjami / znakami z klienta poczty — przycinamy białe znaki
test('token z białymi znakami na brzegach jest przycinany', async ({ page }) => {
  const requests = await open(page, '?t=%20abc.123.def%0A', reply(200, { status: 'confirmed' }));
  await page.getByRole('button', { name: '[ potwierdzam ]' }).click();
  await expect(visible(page, 'confirmed')).toBeVisible();
  expect(requests).toEqual([{ token: 'abc.123.def' }]);
});
