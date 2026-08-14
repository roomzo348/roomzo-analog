/**
 * Slow build: prerenders every /room/:id page (use only when you need static HTML for all listings).
 * Normal deploys should use `npm run build` instead.
 */
import { spawnSync } from 'node:child_process';

process.env.PRERENDER_LISTINGS = '1';

const result = spawnSync(
  process.execPath,
  [
    '--max-old-space-size=6144',
    'node_modules/@angular/cli/bin/ng',
    'build',
  ],
  { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' }
);

process.exit(result.status ?? 1);
