import { defineConfig } from 'vitest/config';

// Vitest owns the unit suite in tests/. The Playwright a11y suite lives in e2e/
// and is run separately via `npm run test:a11y`; exclude it here so vitest does
// not try to collect Playwright's test() (which throws "did not expect test()").
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
