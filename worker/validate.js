// Walidacja danych formularza leadów (czysta funkcja, bez I/O).

export const CONSENT_TEXT =
  'v1: Wyrażam zgodę na przetwarzanie moich danych osobowych podanych w formularzu w celu odpowiedzi na zapytanie, zgodnie z polityką prywatności.';

const MESSAGES = {
  nazwa: 'Podaj imię i nazwisko lub nazwę firmy (2–100 znaków).',
  email: 'Podaj poprawny adres e-mail.',
  telefon: 'Telefon może zawierać tylko cyfry, spacje oraz + - ( ) (maks. 20 znaków).',
  rodzaj_firmy: 'Maksymalnie 100 znaków.',
  zakres_wsparcia: 'Opisz, w czym możemy pomóc (10–2000 znaków).',
  zgoda_rodo: 'Zgoda jest potrzebna, abyśmy mogli odpowiedzieć na zapytanie.',
};

const EMAIL_RE = /^[^\s@,;<>"()\[\]\\]+@[^\s@,;<>"()\[\]\\]+\.[^\s@,;<>"()\[\]\\]{2,}$/;
const PHONE_RE = /^[0-9+\-\s()]*$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const CONTROL_EXCEPT_NL_TAB_RE = /[\u0000-\u0008\u000b-\u001f\u007f]/;

// Zwraca przycięty string, '' dla braku wartości, null dla innego typu.
const text = (v) => (typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : null);

export function validateLead(input) {
  const errors = {};
  const nazwa = text(input.nazwa);
  const email = text(input.email);
  const telefon = text(input.telefon);
  const rodzaj_firmy = text(input.rodzaj_firmy);
  const zakres_wsparcia = text(input.zakres_wsparcia);

  if (nazwa === null || nazwa.length < 2 || nazwa.length > 100 || CONTROL_RE.test(nazwa)) errors.nazwa = MESSAGES.nazwa;
  if (email === null || email.length > 254 || !EMAIL_RE.test(email) || CONTROL_RE.test(email)) errors.email = MESSAGES.email;
  if (telefon === null || telefon.length > 20 || !PHONE_RE.test(telefon) || CONTROL_RE.test(telefon)) errors.telefon = MESSAGES.telefon;
  if (rodzaj_firmy === null || rodzaj_firmy.length > 100 || CONTROL_RE.test(rodzaj_firmy)) errors.rodzaj_firmy = MESSAGES.rodzaj_firmy;
  if (zakres_wsparcia === null || zakres_wsparcia.length < 10 || zakres_wsparcia.length > 2000 || CONTROL_EXCEPT_NL_TAB_RE.test(zakres_wsparcia)) {
    errors.zakres_wsparcia = MESSAGES.zakres_wsparcia;
  }
  if (input.zgoda_rodo !== true) errors.zgoda_rodo = MESSAGES.zgoda_rodo;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, lead: { nazwa, email, telefon, rodzaj_firmy, zakres_wsparcia } };
}
