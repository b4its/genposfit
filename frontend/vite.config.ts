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

// HTTPS EKSPLISIT: set VITE_HTTPS=1 untuk serve https://:3042
// (getUserMedia/kamera butuh secure context saat diakses lewat IP host).
// Tanpa flag → server tetap HTTP murni: http://localhost:3042 normal.
// Jika flag aktif tapi cert belum dibuat jalankan: make certs / npm run certs.
const httpsEnabled = /^(1|true|yes)$/i.test(process.env.VITE_HTTPS || '')
const certDir = path.resolve(__dirname, 'certs')
const keyFile = path.join(certDir, 'dev-key.pem')
const certFile = path.join(certDir, 'dev-cert.pem')
const certOk = fs.existsSync(keyFile) && fs.existsSync(certFile)
if (httpsEnabled && !certOk) {
  console.warn(
    '[genposfit] VITE_HTTPS=1 tetapi cert belum ada — jalankan "sh scripts/gen-certs.sh" ' +
    'di folder frontend/. Serve tetap HTTP biasa.'
  )
}
const https =
  httpsEnabled && certOk
    ? { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }
    : undefined

console.log(
  `[genposfit] Vite dev server mode: ${https ? 'HTTPS — buka https://<ip-host>:3042 (http:// akan ERR_EMPTY_RESPONSE)' : 'HTTP — http://localhost:3042'}`
)

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
