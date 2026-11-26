import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '.cache/vitest',
  test: { include: ['tests/*.test.{ts,tsx}'] },
});
