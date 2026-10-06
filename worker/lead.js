// POST /api/lead: Origin → rate limit → honeypot → walidacja → Turnstile → n8n (tmask-lead-new).
import { readJsonRequest, json, clientIp, csv } from './http.js';
import { validateLead, CONSENT_TEXT } from './validate.js';
import { signToken } from './token.js';
import { verifyTurnstile } from './turnstile.js';
import { callN8n } from './n8n.js';

const TURNSTILE_ERROR = 'Potwierdź, że nie jesteś robotem, i spróbuj ponownie.';

export async function handleLead(request, env, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  const uuid = deps.uuid ?? (() => crypto.randomUUID());

  const parsed = await readJsonRequest(request, env);
  if (parsed.response) return parsed.response;
  const input = parsed.body;
  const ip = clientIp(request);

  const { success } = await env.LEAD_LIMIT.limit({ key: ip });
  if (!success) return json(429, { ok: false }, { 'retry-after': '60' });

  // Honeypot: bot dostaje „sukces”, nic nie idzie dalej
  if (input.website !== undefined && input.website !== '') return json(202, { ok: true });

  const result = validateLead(input);
  if (!result.ok) return json(400, { ok: false, errors: result.errors });

  const human = await verifyTurnstile({
    token: input.turnstile_token,
    ip,
    secret: env.TURNSTILE_SECRET,
    hostnames: csv(env.TURNSTILE_HOSTNAMES),
    action: env.TURNSTILE_ACTION || '',
    fetchImpl,
  });
  if (!human) return json(400, { ok: false, errors: { turnstile: TURNSTILE_ERROR } });

  const leadId = uuid();
  const ts = now();
  const { token, exp } = await signToken(leadId, env.LEAD_HMAC_SECRET, Math.floor(ts.getTime() / 1000));
  const payload = {
    lead_id: leadId,
    ts: ts.toISOString(),
    ...result.lead,
    zgoda_tresc: CONSENT_TEXT,
    confirm_url: `${env.SITE_URL}/potwierdz?t=${encodeURIComponent(token)}`,
    expires_at: new Date(exp * 1000).toISOString(),
    zrodlo: 'tmask.pl',
  };

  const res = await callN8n({ base: env.N8N_WEBHOOK_BASE, path: 'tmask-lead-new', authToken: env.N8N_AUTH_TOKEN, payload, fetchImpl });
  if (res.status < 200 || res.status >= 300 || res.body?.ok !== true) {
    console.error(JSON.stringify({ event: 'lead_new_failed', lead_id: leadId, n8n_status: res.status }));
    return json(502, { ok: false });
  }
  console.log(JSON.stringify({ event: 'lead_new', lead_id: leadId }));
  return json(202, { ok: true });
}
