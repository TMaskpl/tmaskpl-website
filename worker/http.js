// Wspólne helpery HTTP dla endpointów /api/*.

export const MAX_BODY_BYTES = 10 * 1024;

export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const csv = (value) => (value || '').split(',').map((s) => s.trim()).filter(Boolean);

export const clientIp = (request) => request.headers.get('cf-connecting-ip') || 'unknown';

// Sprawdza metodę, Origin, typ i rozmiar; zwraca { body } albo { response } z błędem.
export async function readJsonRequest(request, env) {
  if (request.method !== 'POST') return { response: json(405, { ok: false }, { allow: 'POST' }) };
  if (!csv(env.ALLOWED_ORIGINS).includes(request.headers.get('origin'))) return { response: json(403, { ok: false }) };
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (!type.startsWith('application/json')) return { response: json(415, { ok: false }) };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return { response: json(413, { ok: false }) };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
    return { body };
  } catch {
    return { response: json(400, { ok: false, errors: { _: 'Nieprawidłowe dane formularza.' } }) };
  }
}
