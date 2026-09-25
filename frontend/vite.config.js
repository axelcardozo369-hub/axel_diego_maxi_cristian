import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo, /api se redirige al backend: sin problemas de CORS
    proxy: { '/api': 'http://localhost:3000' },
  },
});
