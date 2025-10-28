import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: [
      'internet-museum-frontend.onrender.com', // replace with your actual Render domain
      'vps-1-006o.onrender.com',               // if applicable
      'localhost'
    ]
  }
})
