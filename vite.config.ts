import { defineConfig } from 'vitest/config';

// base must match the GitHub Pages project subpath so asset URLs resolve
// correctly at https://<user>.github.io/tonesearch/
export default defineConfig({
  base: '/tonesearch/',
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
