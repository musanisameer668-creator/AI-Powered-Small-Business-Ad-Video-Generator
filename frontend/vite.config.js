import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React app runs on :5173 and forwards /api to the Express server on :5000.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000' } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
});
