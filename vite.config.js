import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8080,
    open: true, // ブラウザを自動で開く
  },
  build: {
    rollupOptions: {
      output: {
        // Phaserを別チャンクに分離してビルドを最適化
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) {
            return 'phaser';
          }
        }
      },
    },
  },
});