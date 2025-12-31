
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // We allow process.env to be populated by the environment.
    // If you need to mock it for dev, do it conditionally.
  },
  base: './' 
});
