// vite.config.ts
/// <reference types="vitest" />

import { defineConfig, loadEnv } from 'vite';
import analog from '@analogjs/platform';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { buildPrerenderRoutes } from './scripts/sitemap-routes';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Disable TLS cert verification in dev on Windows when the system CA
  // bundle can't verify outbound HTTPS to the payment gateway.
  if (mode !== 'production') {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  }

  return ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  define: {},
  build: {
    target: ['es2020'],
  },
  resolve: {
    mainFields: ['module'],
    alias: {
      // ✅ Force Vite to use the pre-bundled browser version of SockJS
      'sockjs-client': 'sockjs-client/dist/sockjs.js',
    },
  },
  ssr: {
    noExternal: ['@angular/cdk', '@angular/material'],
  },
  plugins: [
    analog({
      prerender: {
        routes: buildPrerenderRoutes as any,
        sitemap: {
          host: 'https://www.roomzo.in',
        },
      },
      nitro: {
        // Hostinger Node.js apps must run the Node server preset (respects process.env.PORT).
        preset: 'node-server',
        runtimeConfig: {
          mysqlHost: env['MYSQL_HOST'],
          mysqlPort: env['MYSQL_PORT'],
          mysqlUser: env['MYSQL_USER'],
          mysqlPassword: env['MYSQL_PASSWORD'],
          mysqlDatabase: env['MYSQL_DATABASE'],
          smtpHost: env['SMTP_HOST'],
          smtpPort: env['SMTP_PORT'],
          smtpUser: env['SMTP_USER'],
          smtpPass: env['SMTP_PASS'],
          smtpFrom: env['SMTP_FROM'],
          onesignalAppId: env['ONESIGNAL_APP_ID'],
          onesignalApiKey: env['ONESIGNAL_API_KEY'],
          siteUrl: env['SITE_URL'],
          nearbySearchRadiusKm: env['NEARBY_SEARCH_RADIUS_KM'],
          cashfreeAppId: env['CASHFREE_APP_ID'] || env['CASHFREE_CLIENT_ID'],
          cashfreeSecretKey: env['CASHFREE_SECRET_KEY'] || env['CASHFREE_CLIENT_SECRET'],
          cashfreeEnv: env['CASHFREE_ENV'] || 'sandbox',
          contactPlansJson: env['CONTACT_PLANS_JSON'],
        },
        prerender: {
          routes: ['/sitemap.xml'],
          concurrency: 4,
        },
        routeRules: {
          '/room/**': { ssr: true },
          '/edit-listing/**': { ssr: true },
          '/profile/**': { ssr: true },
          '/my-listings/**': { ssr: true },
          '/list-property/**': { ssr: true },
          '/owner-auth/**': { ssr: true },
        },
      },
    }),
    nodePolyfills({
      include: ['util', 'buffer', 'process'],
      globals: {
        global: true,
        process: true,
        Buffer: true,
      },
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['**/*.spec.ts'],
    reporters: ['default'],
  },
});
});