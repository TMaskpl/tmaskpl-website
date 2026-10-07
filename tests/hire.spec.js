// @ts-check
import { test, expect } from '@playwright/test';

const ASTRO = 'http://127.0.0.1:4321/';
// Atrapa Turnstile: render od razu oddaje token, reset oddaje nowy
const TURNSTILE_STUB = `
  window.turnstile = {
    render(el, o) { window.__ts = o; window.__tsRenders = (window.__tsRenders || 0) + 1; setTimeout(() => o.callback('tok-1'), 0); return 'w1'; },
    reset() { window.__tsResets = (window.__tsResets || 0) + 1; setTimeout(() => window.__ts.callback('tok-' + (window.__tsResets + 1)), 0); },
  };`;

// Atrapa: token przychodzi z opóźnieniem (niewidoczny widżet jeszcze weryfikuje)
const TURNSTILE_SLOW = `
  window.turnstile = {
    render(el, o) { window.__ts = o; window.__tsRenders = 1; setTimeout(() => o.callback('tok-slow'), 1500); return 'w1'; },
    reset() {},
  };`;
// Atrapa: weryfikacja kończy się błędem
const TURNSTILE_ERROR = `
  window.turnstile = {
    render(el, o) { window.__ts = o; window.__tsRenders = 1; return 'w1'; },
    reset() {},
  };`;

async function openPage(page, apiHandler, stub = TURNSTILE_STUB) {
  await page.route('https://challenges.cloudflare.com/**', (r) => r.fulfill({ contentType: 'application/javascript', body: stub }));
  const requests = [];
  await page.route('**/api/lead', async (route) => {
    requests.push(route.request().postDataJSON());
    await apiHandler(route, requests.length);
  });
  await page.goto(ASTRO);
  await expect(page.locator('#cmd-input')).toBeEnabled({ timeout: 15_000 });
  return requests;
}

const ok = (route) => route.fulfill({ status: 202, contentType: 'application/json', body: '{"ok":true}' });

async function fill(page) {
  await page.getByLabel('imię i nazwisko / firma').fill('Jan Kowalski');
  await page.getByLabel('e-mail').fill('jan@example.com');
  await page.getByLabel('telefon (opcjonalnie)').fill('+48 600 100 200');
  await page.getByLabel('branża / rodzaj firmy (opcjonalnie)').fill('Biuro');
  await page.getByLabel('w czym mogę pomóc?').fill('Potrzebuję pomocy z siecią w biurze.');
  await page.getByLabel(/Wyrażam zgodę/).check();
  await expect.poll(() => page.evaluate(() => window.__tsRenders)).toBe(1);
}

test('pill hire otwiera okno, Esc zamyka i oddaje fokus', async ({ page }) => {
  await openPage(page, ok);
  await page.locator('.pill[data-cmd="hire"]').click();
  const dialog = page.locator('#hire-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#hire-success')).toBeHidden();
  await expect(page.locator('#hire-form')).toBeVisible();
  await expect(page.getByLabel('imię i nazwisko / firma')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.pill[data-cmd="hire"]')).toBeFocused();
});

test('komenda hire otwiera okno', async ({ page }) => {
  await openPage(page, ok);
  await page.locator('#cmd-input').fill('hire');
  await page.locator('#cmd-input').press('Enter');
  await expect(page.locator('#hire-dialog')).toBeVisible();
});

test('sukces: dokładny payload, komunikat i linia w terminalu', async ({ page }) => {
  const requests = await openPage(page, ok);
  await page.locator('.pill[data-cmd="hire"]').click();
  await fill(page);
  await page.getByRole('button', { name: '[ wyślij ]' }).click();
  await expect(page.locator('#hire-success')).toBeVisible();
  await expect(page.locator('#hire-success')).toContainText('Sprawdź skrzynkę');
  expect(requests).toEqual([{
    nazwa: 'Jan Kowalski', email: 'jan@example.com', telefon: '+48 600 100 200', rodzaj_firmy: 'Biuro',
    zakres_wsparcia: 'Potrzebuję pomocy z siecią w biurze.', zgoda_rodo: true, website: '', turnstile_token: 'tok-1',
  }]);
  await expect(page.locator('#terminal .line.hire-only').last()).toContainText('Zgłoszenie wysłane');
});

test('400: błędy przy polach; Turnstile zresetowany; ponowna wysyłka z nowym tokenem', async ({ page }) => {
  const requests = await openPage(page, (route, n) => n === 1
    ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, errors: { email: 'Podaj poprawny adres e-mail.' } }) })
    : ok(route));
  await page.locator('.pill[data-cmd="hire"]').click();
  await fill(page);
  await page.getByRole('button', { name: '[ wyślij ]' }).click();
  await expect(page.locator('[data-error-for="email"]')).toHaveText('Podaj poprawny adres e-mail.');
  await expect.poll(() => page.evaluate(() => window.__tsResets)).toBe(1);
  await page.getByRole('button', { name: '[ wyślij ]' }).click();
  await expect(page.locator('#hire-success')).toBeVisible();
  expect(requests[1].turnstile_token).toBe('tok-2');
});

for (const [status, text] of [[429, 'Za dużo prób'], [502, 'Nie udało się wysłać']]) {
  test(`${status}: komunikat z alternatywą biuro@tmask.pl`, async ({ page }) => {
    await openPage(page, (route) => route.fulfill({ status, contentType: 'application/json', body: '{"ok":false}' }));
    await page.locator('.pill[data-cmd="hire"]').click();
    await fill(page);
    await page.getByRole('button', { name: '[ wyślij ]' }).click();
    await expect(page.locator('#hire-status')).toContainText(text);
    await expect(page.locator('#hire-status')).toContainText('biuro@tmask.pl');
    await expect.poll(() => page.evaluate(() => window.__tsResets)).toBe(1);
  });
}

test('walidacja przeglądarki blokuje wysyłkę pustego formularza', async ({ page }) => {
  const requests = await openPage(page, ok);
  await page.locator('.pill[data-cmd="hire"]').click();
  await page.getByRole('button', { name: '[ wyślij ]' }).click();
  await expect(page.locator('#hire-dialog')).toBeVisible();
  expect(requests).toHaveLength(0);
});

// Review Focus 3: podwójne kliknięcie → jedno żądanie
test('podwójne kliknięcie wysyła jedno żądanie', async ({ page }) => {
  const requests = await openPage(page, async (route) => { await new Promise((r) => setTimeout(r, 500)); await ok(route); });
  await page.locator('.pill[data-cmd="hire"]').click();
  await fill(page);
  const btn = page.getByRole('button', { name: '[ wyślij ]' });
  await btn.click();
  await expect(page.locator('.hire-submit')).toBeDisabled();
  await page.locator('.hire-submit').click({ force: true }).catch(() => {});
  await expect(page.locator('#hire-success')).toBeVisible();
  expect(requests).toHaveLength(1);
});

test('honeypot jest niewidoczny i poza kolejnością tabulacji', async ({ page }) => {
  await openPage(page, ok);
  await page.locator('.pill[data-cmd="hire"]').click();
  const hp = page.locator('input[name="website"]');
  await expect(hp).toHaveAttribute('tabindex', '-1');
  await expect(hp).not.toBeInViewport();
});

test('widżet Turnstile renderowany jako interaction-only', async ({ page }) => {
  await openPage(page, ok);
  await page.locator('.pill[data-cmd="hire"]').click();
  await expect.poll(() => page.evaluate(() => window.__ts?.appearance)).toBe('interaction-only');
});

test('wysyłka przed tokenem czeka na weryfikację, potem wysyła', async ({ page }) => {
  const requests = await openPage(page, ok, TURNSTILE_SLOW);
  await page.locator('.pill[data-cmd="hire"]').click();
  await fill(page);
  await page.getByRole('button', { name: '[ wyślij ]' }).click();
  await expect(page.locator('#hire-status')).toHaveText('Trwa weryfikacja antyspamowa…');
  await expect(page.locator('.hire-submit')).toBeDisabled();
  await expect(page.locator('#hire-success')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].turnstile_token).toBe('tok-slow');
});

test('błąd weryfikacji: komunikat od razu, bez wysyłki', async ({ page }) => {
  const requests = await openPage(page, ok, TURNSTILE_ERROR);
  await page.locator('.pill[data-cmd="hire"]').click();
  await fill(page);
  await page.getByRole('button', { name: '[ wyślij ]' }).click();
  await expect(page.locator('#hire-status')).toHaveText('Trwa weryfikacja antyspamowa…');
  await page.evaluate(() => window.__ts['error-callback']());
  await expect(page.locator('[data-error-for="turnstile"]')).toContainText('Weryfikacja antyspamowa nie powiodła się');
  await expect(page.getByRole('button', { name: '[ wyślij ]' })).toBeEnabled();
  expect(requests).toHaveLength(0);
});
