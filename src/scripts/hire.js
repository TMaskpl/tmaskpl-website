// Okno formularza „hire”: otwieranie, Turnstile (ładowany przy pierwszym otwarciu), wysyłka do /api/lead.

const SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const MSG = {
  turnstile: 'Potwierdź, że nie jesteś robotem.',
  turnstileLoad: 'Nie udało się załadować zabezpieczenia antyspamowego. Odśwież stronę albo napisz na biuro@tmask.pl.',
  tooMany: 'Za dużo prób. Odczekaj minutę i spróbuj ponownie albo napisz na biuro@tmask.pl.',
  failed: 'Nie udało się wysłać zgłoszenia. Spróbuj później albo napisz na biuro@tmask.pl.',
};

const dialog = document.getElementById('hire-dialog');
const form = document.getElementById('hire-form');
const success = document.getElementById('hire-success');
const status = document.getElementById('hire-status');
const submit = form.querySelector('.hire-submit');

let opener = null;
let widgetId = null;
let turnstileToken = '';
let loadPromise = null;
let busy = false;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  loadPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TURNSTILE_SRC;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
  return loadPromise;
}

function setFieldError(field, message) {
  const el = form.querySelector(`[data-error-for="${field}"]`);
  if (el) el.textContent = message;
  else status.textContent = message;
}

function clearErrors() {
  form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
  status.textContent = '';
}

function resetTurnstile() {
  turnstileToken = '';
  if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
}

async function openHire() {
  opener = document.activeElement;
  if (!form.hidden && success.hidden) clearErrors();
  dialog.showModal();
  (form.hidden ? success.querySelector('button') : form.elements.nazwa).focus();
  try {
    await loadTurnstile();
    if (widgetId === null) {
      widgetId = window.turnstile.render('#hire-turnstile', {
        sitekey: SITE_KEY,
        action: 'lead',
        theme: 'dark',
        callback: (t) => { turnstileToken = t; setFieldError('turnstile', ''); },
        'expired-callback': () => { turnstileToken = ''; },
        'error-callback': () => { turnstileToken = ''; },
      });
    }
  } catch {
    status.textContent = MSG.turnstileLoad;
  }
}

dialog.addEventListener('close', () => { if (opener && document.contains(opener)) opener.focus(); });
dialog.querySelectorAll('[data-hire-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
window.addEventListener('tmask:open-hire', openHire);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  clearErrors();
  if (!turnstileToken) { setFieldError('turnstile', MSG.turnstile); return; }

  const f = form.elements;
  const payload = {
    nazwa: f.nazwa.value,
    email: f.email.value,
    telefon: f.telefon.value,
    rodzaj_firmy: f.rodzaj_firmy.value,
    zakres_wsparcia: f.zakres_wsparcia.value,
    zgoda_rodo: f.zgoda_rodo.checked,
    website: f.website.value,
    turnstile_token: turnstileToken,
  };

  busy = true;
  submit.disabled = true;
  submit.textContent = 'wysyłanie…';
  let res = null;
  try {
    res = await fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  } catch { /* sieć */ }
  busy = false;
  submit.disabled = false;
  submit.textContent = '[ wyślij ]';

  if (res && res.status === 202) {
    form.hidden = true;
    success.hidden = false;
    success.querySelector('button').focus();
    window.dispatchEvent(new CustomEvent('tmask:lead-sent'));
    return;
  }
  resetTurnstile(); // token Turnstile jest jednorazowy
  if (res && res.status === 400) {
    const body = await res.json().catch(() => ({}));
    for (const [field, message] of Object.entries(body.errors || {})) setFieldError(field, message);
    return;
  }
  status.textContent = res && res.status === 429 ? MSG.tooMany : MSG.failed;
});
