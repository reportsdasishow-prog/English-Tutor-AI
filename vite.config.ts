
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {} // Заглушка для process.env, если используется в браузере
  },
  base: './' // Важно для корректных путей на GitHub Pages
});
