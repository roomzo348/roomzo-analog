module.exports = {
  apps: [
    {
      name: 'roomzo',
      script: 'dist/analog/server/index.mjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NITRO_PORT: 3000,
        HOST: '0.0.0.0',
      },
    },
  ],
};
