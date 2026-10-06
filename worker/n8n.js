// Wywołanie webhooka n8n: POST JSON z nagłówkiem X-Tmask-Auth, timeout, bez ponowień.

export const N8N_TIMEOUT_MS = 10_000;

export async function callN8n({ base, path, authToken, payload, fetchImpl = fetch, timeoutMs = N8N_TIMEOUT_MS }) {
  try {
    const res = await fetchImpl(`${base.replace(/\/+$/, '')}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tmask-auth': authToken },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let body = null;
    try { body = await res.json(); } catch { /* odpowiedź nie-JSON */ }
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  }
}
