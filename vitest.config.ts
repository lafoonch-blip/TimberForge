import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Resolve workspace packages to source, not dist, so tests never pass
      // against a stale build. A green test on yesterday's dist is worse than
      // a red one.
      '@timberforge/forestry-core': r('./packages/forestry-core/src/index.ts'),
      '@timberforge/landforge-contract': r(
        './packages/landforge-contract/src/index.ts'
      ),
    },
  },
  test: {
    // scripts/ is included because the region-seed generator has a guard test
    // that keeps the SQL migration in step with regions.ts.
    include: [
      'packages/**/test/**/*.test.ts',
      'apps/**/test/**/*.test.{ts,tsx}',
      'scripts/**/*.test.ts',
      'supabase/**/*.test.ts',
    ],
    // Each migration test boots a WebAssembly Postgres, which takes a moment.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    environment: 'node',
  },
});
