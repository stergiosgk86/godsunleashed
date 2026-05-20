import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

// Pad the patch segment to always show 2 digits (e.g. 0.3.4 → 0.3.04)
const [major, minor, patch = '0'] = version.split('.')
const displayVersion = `${major}.${minor}.${patch.padStart(2, '0')}`

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(displayVersion),
  },
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
})
