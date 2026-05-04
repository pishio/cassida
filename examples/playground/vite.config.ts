import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cassida from '@cassida/vite-plugin';
import hoverFix from '@cassida/plugin-hover-fix';

export default defineConfig({
  plugins: [cassida({ plugins: [hoverFix()] }), react()],
});
