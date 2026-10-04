/// <reference types="vitest/config" />
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-math', test: /node_modules[\\/](mathjs|complex\.js|fraction\.js|decimal\.js|typed-function|seedrandom|javascript-natural-sort|escape-latex|tiny-emitter)/ },
            { name: 'vendor-katex', test: /node_modules[\\/]katex/ },
            { name: 'vendor-flow', test: /node_modules[\\/](@xyflow|d3-)/ },
            { name: 'vendor-ui', test: /node_modules[\\/](radix-ui|@radix-ui|lucide-react|sonner|react-resizable-panels)/ },
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
