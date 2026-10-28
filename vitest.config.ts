import { defineConfig } from 'vitest/config';

// Unit tests cover the pure modules only (URL building, quality tiers, scene
// timing, building parameters). The WebGL scene is verified in the browser.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
