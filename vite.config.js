import { defineConfig } from 'vite';

export default defineConfig({
  // CrazyGames serves the build from its own folder, so every path must be relative
  base: './',
  build: { target: 'es2022' },
});
