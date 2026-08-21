import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { studioServer } from './vite-plugins/studio-server.js'

export default defineConfig({
  plugins: [react(), studioServer()],
  server: { fs: { allow: ['.'] } },
})
