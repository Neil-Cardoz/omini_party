import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@celebraitions/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
