import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    entries: ['index.html'],
    include: ["three", "three/examples/jsm/environments/RoomEnvironment.js"],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: false,
    allowedHosts: true,
    watch: {
      ignored: ['**/android/**', '**/tests/**', '**/dist/**', '**/scripts/**'],
    },
    proxy: {
      '/audio-proxy': {
        target: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/audio-proxy/, ''),
      },
    },
  },
});