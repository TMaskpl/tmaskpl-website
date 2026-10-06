// Strona /potwierdz: token z ?t=, potwierdzenie dopiero po kliknięciu (skanery linków nie potwierdzają).

const STATUS_TO_STATE = { 400: 'invalid', 404: 'invalid', 410: 'expired' };

const token = (new URLSearchParams(location.search).get('t') || '').trim();
// Token nie zostaje w pasku adresu ani w historii
history.replaceState(null, '', location.pathname);

const button = document.getElementById('confirm-btn');
let busy = false;

function show(state) {
  document.querySelectorAll('[data-state]').forEach((el) => {
    el.hidden = !el.dataset.state.split(' ').includes(state);
  });
}

if (!token) show('invalid');

button.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  button.disabled = true;
  show('busy');
  let res = null;
  try {
    res = await fetch('/api/lead/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
  } catch { /* sieć */ }
  busy = false;
  button.disabled = false;
  if (res && res.status === 200) {
    const body = await res.json().catch(() => ({}));
    show(body.status === 'already' ? 'already' : 'confirmed');
    return;
  }
  show((res && STATUS_TO_STATE[res.status]) || 'error');
});
