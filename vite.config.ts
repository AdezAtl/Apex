import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: false,
    host: true,
    watch: {
      ignored: ['**/.tmp*/**', '**/dist/**', '**/assets/**', '**/*.7z', '**/*.zip', '**/*.rar'],
    },
  },
  build: {
    target: 'esnext',
  },
});
