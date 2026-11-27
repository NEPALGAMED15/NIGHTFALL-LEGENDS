import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      {
        name: 'android-apk-mime-headers',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const urlPath = (req.url || '').split('?')[0];
            if (urlPath.endsWith('.apk')) {
              const filename = path.basename(urlPath);
              res.setHeader('Content-Type', 'application/vnd.android.package-archive');
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
              res.setHeader('X-Content-Type-Options', 'nosniff');
            } else if (urlPath.endsWith('.aab')) {
              const filename = path.basename(urlPath);
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
              res.setHeader('X-Content-Type-Options', 'nosniff');
            }
            next();
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, res, next) => {
            const urlPath = (req.url || '').split('?')[0];
            if (urlPath.endsWith('.apk')) {
              const filename = path.basename(urlPath);
              res.setHeader('Content-Type', 'application/vnd.android.package-archive');
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
              res.setHeader('X-Content-Type-Options', 'nosniff');
            } else if (urlPath.endsWith('.aab')) {
              const filename = path.basename(urlPath);
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
              res.setHeader('X-Content-Type-Options', 'nosniff');
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
