import { defineConfig, loadEnv, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { join } from 'path'

// Read version from VERSION file
function getVersion(): string {
  try {
    const versionFile = join(__dirname, 'VERSION')
    const version = readFileSync(versionFile, 'utf-8').trim()
    return version || 'dev'
  } catch {
    return 'dev'
  }
}

// Plugin to inject version from VERSION file
function versionPlugin(): Plugin {
  return {
    name: 'inject-version',
    config(config, { mode }) {
      const env = loadEnv(mode, process.cwd(), '')
      // Only set if not already provided via environment
      if (!env.VITE_APP_VERSION) {
        const version = getVersion()
        // Set in process.env so Vite picks it up
        process.env.VITE_APP_VERSION = version
        // Also inject via define as fallback
        config.define = {
          ...config.define,
          'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
        }
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), versionPlugin()],
  server: {
    port: 3000,
    host: true, // Listen on all addresses, including network
    strictPort: true, // Exit if port is already in use
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})

