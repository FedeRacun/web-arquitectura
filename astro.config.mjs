// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// `site` stays unset until an architect's domain exists: canonical URLs and
// absolute Open Graph image URLs depend on it.
// https://astro.build/config
export default defineConfig({
  // Fonts are downloaded at build time and self-hosted from /_astro/fonts/.
  // To use the licensed pair (PP Editorial New + Neue Haas Grotesk), swap
  // these two entries for `fontProviders.local()` with the licensed files and
  // keep the same cssVariable names: nothing else references the families.
  fonts: [
    {
      name: 'DM Serif Display',
      cssVariable: '--font-dm-serif-display',
      provider: fontProviders.fontsource(),
      weights: [400],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['serif'],
    },
    {
      name: 'DM Sans',
      cssVariable: '--font-dm-sans',
      provider: fontProviders.fontsource(),
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
  ],
  build: {
    // One small stylesheet: inlining it saves a render-blocking round trip.
    inlineStylesheets: 'always',
  },
  vite: {
    plugins: [tailwindcss()],
    // The scene chunk (three, gsap, lenis) is large on purpose and loads after the first paint;
    // the real limit is the 250 KB gzip budget enforced by `pnpm budget`.
    build: { chunkSizeWarningLimit: 800 },
  },
});
