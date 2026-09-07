import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'development-csp',
    apply: 'serve',
    // React Fast Refresh has an inline development preamble; production keeps the strict CSP.
    transformIndexHtml(html) {
      return html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';");
    },
  }],
  build: {
    rollupOptions: {
      output: {
        // Some static hosts serve .mjs as application/octet-stream, which module
        // workers reject. Keep PDF.js's ESM bytes and hashed URL, but use .js.
        assetFileNames: asset => asset.names.some(name => name === 'pdf.worker.min.mjs')
          ? 'assets/[name]-[hash].js'
          : 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
