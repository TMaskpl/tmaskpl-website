// Worker przed statycznym buildem Astro (assets z dist/).
// Kanoniczny adres to https://tmask.pl — http i www przekierowujemy 301.
// Pozostałe hosty (workers.dev, localhost) obsługujemy bez przekierowań.

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

    return env.ASSETS.fetch(request);
  },
};
