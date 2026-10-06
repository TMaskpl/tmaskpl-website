// Worker przed statycznym buildem Astro (assets z dist/).
// Kanoniczny adres to https://tmask.pl — http i www przekierowujemy 301.
// Pozostałe hosty (workers.dev, localhost) obsługujemy bez przekierowań.
import { handleLead } from './lead.js';
import { handleConfirm } from './confirm.js';
import { json } from './http.js';

const CANONICAL_HOST = 'tmask.pl';
const REDIRECT_HOSTS = new Set([CANONICAL_HOST, `www.${CANONICAL_HOST}`]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (REDIRECT_HOSTS.has(url.hostname) && (url.protocol === 'http:' || url.hostname !== CANONICAL_HOST)) {
      url.protocol = 'https:';
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/api/lead') return handleLead(request, env);
    if (url.pathname === '/api/lead/confirm') return handleConfirm(request, env);
    if (url.pathname.startsWith('/api/')) return json(404, { ok: false });

    return env.ASSETS.fetch(request);
  },
};
