module.exports = {
  apps: [
    {
      name: 'feedback-server',
      cwd: '/var/www/feedback-app/server',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      max_memory_restart: '300M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
