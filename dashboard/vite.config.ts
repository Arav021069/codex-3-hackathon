import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/auth': 'http://127.0.0.1:9000',
      '/company-demo-state': 'http://127.0.0.1:9000',
      '/audit-chain': 'http://127.0.0.1:9000',
      '/intercept': 'http://127.0.0.1:9000',
      '/decision': 'http://127.0.0.1:9000',
      '/pending': 'http://127.0.0.1:9000',
      '/sessions': 'http://127.0.0.1:9000',
      '/session': 'http://127.0.0.1:9000',
      '/inspect': 'http://127.0.0.1:9000',
      '/ollama': 'http://127.0.0.1:9000',
      '/ws': { target: 'ws://127.0.0.1:9000', ws: true },
    },
  },
});
