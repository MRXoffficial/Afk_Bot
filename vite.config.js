import { defineConfig } from 'vite'

// Arayuz src/ icinde, Node projesi static/nodejs icinde (dist/nodejs'e kopyalanir)
export default defineConfig({
  root: './src',
  base: './',
  publicDir: '../static',
  build: { outDir: '../dist', emptyOutDir: true }
})
