import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento o Vite roda na 5175 e faz proxy da /api para o Express
// na 3335. Em produção o build sai em web/dist e é servido pelo próprio
// Express — uma porta só.
//
// 5175/3335: terceira porta da família, para conviver com o
// AtendimentoLocaPronto (5174/3334) e o painel financeiro (5173/3333) na
// mesma máquina de desenvolvimento.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': { target: 'http://localhost:3335', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
