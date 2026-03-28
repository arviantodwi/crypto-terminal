import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Allows integration tests to import from the package name directly,
      // without requiring a build step (see tests/integration.test.ts).
      '@crypto-terminal/trade-formula': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
});
