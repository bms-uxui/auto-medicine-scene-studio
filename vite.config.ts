import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { studioServer } from './vite-plugins/studio-server.js'

export default defineConfig({
  // GitHub Pages serves a project site from a sub-path; the deploy script sets this and
  // it stays '/' everywhere else
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), studioServer()],
  server: { fs: { allow: ['.'] } },
})
