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
reference/original.html     oryginalna strona — wzorzec dla testów parytetu
tests/parity.spec.js        Playwright: oryginał vs build (DOM + piksele, desktop i mobile)
```

## Komendy

```bash
npm ci
npm run dev        # http://localhost:4321
npm test           # testy parytetu (budują projekt i serwują przez wrangler dev)
```

Deploy: automatyczny przez Cloudflare Workers Builds po pushu do `main`
(build: `npm run build`, deploy: `npx wrangler deploy`).

Sekrety: nigdy w repo. Runtime: `wrangler secret put NAZWA`, lokalnie `.dev.vars` (w `.gitignore`).
