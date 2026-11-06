import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Configuración de Vite (compilación) y Vitest (pruebas del núcleo en tests/).
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
