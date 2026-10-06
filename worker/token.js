// Podpisany token potwierdzenia: base64url(lead_id).exp.base64url(HMAC-SHA256(lead_id.exp)).

export const TOKEN_TTL_SECONDS = 48 * 3600;

const enc = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nowSec = () => Math.floor(Date.now() / 1000);

const toB64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (s) => {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('bad base64url');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const hmacKey = (secret) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function signToken(leadId, secret, nowSeconds = nowSec()) {
  const exp = nowSeconds + TOKEN_TTL_SECONDS;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`${leadId}.${exp}`));
  return { token: `${toB64url(enc.encode(leadId))}.${exp}.${toB64url(sig)}`, exp };
}

export async function verifyToken(token, secret, nowSeconds = nowSec()) {
  const invalid = { status: 'invalid' };
  if (typeof token !== 'string' || token.length > 512) return invalid;
  const parts = token.split('.');
  if (parts.length !== 3 || !/^\d{1,12}$/.test(parts[1])) return invalid;
  let leadId;
  let sig;
  try {
    leadId = new TextDecoder('utf-8', { fatal: true }).decode(fromB64url(parts[0]));
    sig = fromB64url(parts[2]);
  } catch {
    return invalid;
  }
  if (!UUID_RE.test(leadId)) return invalid;
  // crypto.subtle.verify porównuje w stałym czasie
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), sig, enc.encode(`${leadId}.${parts[1]}`));
  if (!ok) return invalid;
  if (Number(parts[1]) <= nowSeconds) return { status: 'expired' };
  return { status: 'valid', leadId };
}
