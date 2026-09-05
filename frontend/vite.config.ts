import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// VITE_API_PROXY: URL yang dituju oleh proxy dev server (default: Docker network).
const proxyTarget = process.env.VITE_API_PROXY || 'http://backend:8042'

// HTTPS opsional: jika certs/ ada, dev server serve HTTPS agar getUserMedia
// (kamera) tersedia saat diakses lewat IP host — browser hanya mengizinkan
// kamera di secure context (https / localhost).
const certDir = path.resolve(__dirname, 'certs')
const keyFile = path.join(certDir, 'dev-key.pem')
const certFile = path.join(certDir, 'dev-cert.pem')
const https =
  fs.existsSync(keyFile) && fs.existsSync(certFile)
    ? { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }
    : undefined

// https://vite.dev/config/
export default defineConfig({
    plugins: [
      react(),
      tailwindcss(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3042,
      https,
      // Proxy API ke backend: browser hanya melihat origin yang sama (relatif '/api'),
      // sehingga tidak ada masalah CORS dan tidak bergantung pada localhost browser.
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true, // dukung WebSocket /api/monitoring/ws & /api/multiplayer/ws
        },
      },
    },
})
