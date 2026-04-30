import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fss from '@fss/vite-plugin';

export default defineConfig({
  plugins: [fss(), react()],
});
