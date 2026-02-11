import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const allowedHosts = process.env.VITE_ALLOWED_HOSTS
  ? process.env.VITE_ALLOWED_HOSTS.split(',')
  : [];

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    watch: {
      usePolling: true
    }
  }
})
