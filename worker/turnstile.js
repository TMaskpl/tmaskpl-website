// Weryfikacja tokenu Cloudflare Turnstile po stronie serwera.

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const fail = (reason) => ({ ok: false, reason });

export async function verifyTurnstile({ token, ip, secret, hostnames, action, fetchImpl = fetch }) {
  if (typeof token !== 'string' || !token || token.length > 2048) return fail('missing_token');
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip && ip !== 'unknown') form.append('remoteip', ip);
  try {
    const res = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return fail(`http_${res.status}`);
    const data = await res.json();
    if (data.success !== true) {
      const codes = Array.isArray(data['error-codes']) ? data['error-codes'].join(',') : '';
      return fail(codes ? `not_success:${codes}` : 'not_success');
    }
    if (hostnames.length && !hostnames.includes(data.hostname)) return fail('hostname_mismatch');
    if (action && data.action !== action) return fail('action_mismatch');
    return { ok: true, reason: '' };
  } catch {
    return fail('network');
  }
}
