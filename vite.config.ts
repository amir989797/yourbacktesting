import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_ADMINPASS': JSON.stringify(
      process.env.adminpass || process.env.ADMINPASS || '!#@Amir'
    ),
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});

