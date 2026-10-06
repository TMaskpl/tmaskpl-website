// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tmask.pl',
  output: 'static',
  // 1:1 z oryginałem — bez kompresji białych znaków (terminal je renderuje)
  compressHTML: false,
  build: { format: 'file' },
});
