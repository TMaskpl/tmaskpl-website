// Weryfikacja tokenu Cloudflare Turnstile po stronie serwera.

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile({ token, ip, secret, hostnames, action, fetchImpl = fetch }) {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip && ip !== 'unknown') form.append('remoteip', ip);
  try {
    const res = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.success !== true) return false;
    if (hostnames.length && !hostnames.includes(data.hostname)) return false;
    if (action && data.action !== action) return false;
    return true;
  } catch {
    return false;
  }
}
