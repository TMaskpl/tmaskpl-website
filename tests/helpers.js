// Wspólne atrapy dla testów handlerów Workera.

export const makeEnv = (over = {}) => ({
  SITE_URL: 'https://tmask.pl',
  ALLOWED_ORIGINS: 'https://tmask.pl',
  TURNSTILE_HOSTNAMES: 'tmask.pl',
  TURNSTILE_ACTION: 'lead',
  TURNSTILE_SECRET: 'ts-secret',
  LEAD_HMAC_SECRET: 'hmac-secret',
  N8N_WEBHOOK_BASE: 'https://n8n.example/webhook',
  N8N_AUTH_TOKEN: 'n8n-token',
  LEAD_LIMIT: { limit: async () => ({ success: true }) },
  CONFIRM_LIMIT: { limit: async () => ({ success: true }) },
  ...over,
});

// turnstile: odpowiedź siteverify; n8n: {status, body} albo 'down' (błąd sieci)
export function fakeFetch({ turnstile = { success: true, hostname: 'tmask.pl', action: 'lead' }, n8n = { status: 200, body: { ok: true } } } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith('https://challenges.cloudflare.com/')) return Response.json(turnstile);
    if (n8n === 'down') throw new Error('connection refused');
    return new Response(JSON.stringify(n8n.body), { status: n8n.status, headers: { 'content-type': 'application/json' } });
  };
  fn.calls = calls;
  fn.n8nCalls = () => calls.filter((c) => c.url.startsWith('https://n8n.example/'));
  return fn;
}

export const apiRequest = (path, body, { origin = 'https://tmask.pl', ip = '203.0.113.7' } = {}) =>
  new Request(`https://tmask.pl${path}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  });
