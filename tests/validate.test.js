import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLead, CONSENT_TEXT } from '../worker/validate.js';

const valid = () => ({
  nazwa: '  Jan Kowalski ', email: ' jan@example.com ', telefon: '+48 600-100-200', rodzaj_firmy: 'Biuro rachunkowe',
  zakres_wsparcia: 'Potrzebuję pomocy z kopiami zapasowymi.', zgoda_rodo: true,
});

test('CONSENT_TEXT ma wersję v1 i pełną treść zgody', () => {
  assert.equal(CONSENT_TEXT, 'v1: Wyrażam zgodę na przetwarzanie moich danych osobowych podanych w formularzu w celu odpowiedzi na zapytanie, zgodnie z polityką prywatności.');
});

test('poprawne dane → ok, przycięte, bez pól spoza listy', () => {
  const r = validateLead({ ...valid(), extra: 'x', zgoda_rodo: true });
  assert.equal(r.ok, true);
  assert.deepEqual(r.lead, {
    nazwa: 'Jan Kowalski', email: 'jan@example.com', telefon: '+48 600-100-200',
    rodzaj_firmy: 'Biuro rachunkowe', zakres_wsparcia: 'Potrzebuję pomocy z kopiami zapasowymi.',
  });
});

test('pola opcjonalne mogą być puste lub nieobecne', () => {
  const { telefon, rodzaj_firmy, ...rest } = valid();
  const r = validateLead(rest);
  assert.equal(r.ok, true);
  assert.equal(r.lead.telefon, '');
  assert.equal(r.lead.rodzaj_firmy, '');
});

const errorFor = (patch, field) => {
  const r = validateLead({ ...valid(), ...patch });
  assert.equal(r.ok, false, JSON.stringify(patch));
  assert.ok(r.errors[field], `brak błędu dla ${field}: ${JSON.stringify(r.errors)}`);
};

test('nazwa: wymagana, 2–100 znaków', () => {
  errorFor({ nazwa: '' }, 'nazwa');
  errorFor({ nazwa: 'J' }, 'nazwa');
  errorFor({ nazwa: 'x'.repeat(101) }, 'nazwa');
  assert.equal(validateLead({ ...valid(), nazwa: 'x'.repeat(100) }).ok, true);
});

test('email: format i długość', () => {
  for (const email of ['', 'jan', 'jan@', '@example.com', 'jan@example', 'jan kowalski@example.com', `${'a'.repeat(250)}@x.pl`]) {
    errorFor({ email }, 'email');
  }
});

test('telefon: tylko cyfry + - spacja ( ), maks. 20', () => {
  errorFor({ telefon: '600 abc' }, 'telefon');
  errorFor({ telefon: '1'.repeat(21) }, 'telefon');
  assert.equal(validateLead({ ...valid(), telefon: '(+48) 600 100 200' }).ok, true);
});

test('rodzaj_firmy: maks. 100', () => errorFor({ rodzaj_firmy: 'x'.repeat(101) }, 'rodzaj_firmy'));

test('zakres_wsparcia: 10–2000, wieloliniowy dozwolony', () => {
  errorFor({ zakres_wsparcia: 'za krótko' }, 'zakres_wsparcia');
  errorFor({ zakres_wsparcia: 'x'.repeat(2001) }, 'zakres_wsparcia');
  assert.equal(validateLead({ ...valid(), zakres_wsparcia: 'Linia 1\nLinia 2\tok' }).ok, true);
});

test('zgoda_rodo: wyłącznie true (nie "true", nie 1)', () => {
  for (const zgoda_rodo of [false, 'true', 1, undefined, null]) errorFor({ zgoda_rodo }, 'zgoda_rodo');
});

// Review Focus 1: znaki sterujące w polach jednowierszowych trafiłyby do tematu/nagłówków maila
test('pola jednowierszowe odrzucają znaki nowej linii i sterujące', () => {
  errorFor({ nazwa: 'Jan\nBcc: x@y.pl' }, 'nazwa');
  errorFor({ email: 'jan@example.com\r\nBcc: x@y.pl' }, 'email');
  errorFor({ rodzaj_firmy: 'IT\u0000' }, 'rodzaj_firmy');
  errorFor({ telefon: '600\n100' }, 'telefon');
});

test('zakres_wsparcia odrzuca znaki sterujące poza \\n i \\t', () => {
  errorFor({ zakres_wsparcia: 'Pomoc z siecią \u0007 proszę' }, 'zakres_wsparcia');
});

// Review Focus 2: nietypowe typy JSON
test('nie-stringi w polach tekstowych → błąd pola, bez wyjątku', () => {
  errorFor({ nazwa: 123 }, 'nazwa');
  errorFor({ email: ['a@b.pl'] }, 'email');
  errorFor({ zakres_wsparcia: { a: 1 } }, 'zakres_wsparcia');
  errorFor({ telefon: 600100200 }, 'telefon');
});
