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
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
