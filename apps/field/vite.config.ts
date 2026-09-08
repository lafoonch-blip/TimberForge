import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Same rule as the test config: resolve the workspace package to source.
      // A cruiser in the field running against yesterday's dist, while the
      // server recompiles against today's, is the exact divergence the engine
      // stamp exists to catch — better not to create it in development.
      '@timberforge/forestry-core': r('../../packages/forestry-core/src/index.ts'),
    },
  },
  server: { port: 5173 },
  build: { target: 'es2022', sourcemap: true },
});
