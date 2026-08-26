import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        // Split rarely-changing vendor code into its own chunk so a normal
        // app-code deploy doesn't force every returning user to re-download
        // React/animation/icon libraries they already have cached.
        manualChunks: {
          vendor: ['react', 'react-dom', 'framer-motion'],
          icons: ['lucide-react']
        }
      }
    }
  }
});
