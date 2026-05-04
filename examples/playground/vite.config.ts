import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fss from '@fss/vite-plugin';
import hoverFix from '@fss/plugin-hover-fix';

export default defineConfig({
  plugins: [fss({ plugins: [hoverFix()] }), react()],
});
