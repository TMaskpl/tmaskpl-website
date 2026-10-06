# tmask.pl

Strona https://tmask.pl. Astro (statyczny build) hostowany na Cloudflare Workers (static assets).

## Struktura

```
src/
  layouts/Base.astro        <head>: meta, Open Graph, JSON-LD
  components/Terminal.astro okno terminala + szybkie komendy
  components/SeoContent.astro  treść semantyczna (sr-only) dla wyszukiwarek/AI
  styles/terminal.css
  scripts/terminal.js       silnik terminala i komendy
public/                     robots.txt, llms.txt, sitemap.xml
worker/index.js             Worker: 301 http→https i www→tmask.pl, reszta z ASSETS
reference/original.html     oryginalna strona — wzorzec dla testów parytetu
tests/parity.spec.js        Playwright: oryginał vs build (DOM + piksele, desktop i mobile)
tests/worker.test.js        node:test — przekierowania Workera
```

## Komendy

```bash
npm ci
npm run dev        # http://localhost:4321
npm test           # test Workera + testy parytetu (build serwowany przez wrangler dev)
```

## Formularz leadów (`hire`)

`/api/lead` i `/api/lead/confirm` obsługuje Worker (`worker/`), dane trafiają do webhooków n8n
`tmask-lead-new` / `tmask-lead-confirm` (workflow „Onbording TMaskPL”). Double opt-in: mail AI
wychodzi dopiero po potwierdzeniu na `/potwierdz`.

Sekrety Workera (`wrangler secret put`): `TURNSTILE_SECRET`, `N8N_WEBHOOK_BASE`, `N8N_AUTH_TOKEN`,
`LEAD_HMAC_SECRET`. Lokalnie: `.dev.vars` na wzór `.dev.vars.example`.

Domeny `tmask.pl` i `www.tmask.pl` to Custom Domains Workera (`routes` w `wrangler.jsonc`).

Deploy: automatyczny przez Cloudflare Workers Builds po pushu do `main`
(build: `npm run build`, deploy: `npx wrangler deploy`).

Sekrety: nigdy w repo. Runtime: `wrangler secret put NAZWA`, lokalnie `.dev.vars` (w `.gitignore`).
