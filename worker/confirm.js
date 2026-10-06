// POST /api/lead/confirm: Origin → rate limit → token → n8n (tmask-lead-confirm).
import { readJsonRequest, json, clientIp } from './http.js';
import { verifyToken } from './token.js';
import { callN8n } from './n8n.js';

export async function handleConfirm(request, env, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());

  const parsed = await readJsonRequest(request, env);
  if (parsed.response) return parsed.response;

  const { success } = await env.CONFIRM_LIMIT.limit({ key: clientIp(request) });
  if (!success) return json(429, { status: 'error' }, { 'retry-after': '60' });

  const ts = now();
  const check = await verifyToken(parsed.body.token, env.LEAD_HMAC_SECRET, Math.floor(ts.getTime() / 1000));
  if (check.status === 'invalid') return json(400, { status: 'invalid' });
  if (check.status === 'expired') return json(410, { status: 'expired' });

  const res = await callN8n({
    base: env.N8N_WEBHOOK_BASE,
    path: 'tmask-lead-confirm',
    authToken: env.N8N_AUTH_TOKEN,
    payload: { lead_id: check.leadId, ts: ts.toISOString() },
    fetchImpl,
  });
  if (res.status === 404 && res.body?.status === 'not_found') return json(404, { status: 'not_found' });
  const status = res.body?.status;
  if (res.status >= 200 && res.status < 300 && (status === 'confirmed' || status === 'already')) {
    console.log(JSON.stringify({ event: 'lead_confirm', lead_id: check.leadId, status }));
    return json(200, { status });
  }
  console.error(JSON.stringify({ event: 'lead_confirm_failed', lead_id: check.leadId, n8n_status: res.status }));
  return json(502, { status: 'error' });
}
