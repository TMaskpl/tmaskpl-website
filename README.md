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

Domeny `tmask.pl` i `www.tmask.pl` to Custom Domains Workera (`routes` w `wrangler.jsonc`).

Deploy: automatyczny przez Cloudflare Workers Builds po pushu do `main`
(build: `npm run build`, deploy: `npx wrangler deploy`).

Sekrety: nigdy w repo. Runtime: `wrangler secret put NAZWA`, lokalnie `.dev.vars` (w `.gitignore`).
