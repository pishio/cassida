import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cassida from '@cassida/vite-plugin';

export default defineConfig({
  plugins: [cassida(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
  },
});
