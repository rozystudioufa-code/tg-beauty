// PM2 — менеджер процессов. Держит бэкенд запущенным, перезапускает при сбоях.
module.exports = {
  apps: [
    {
      name: 'beauty-backend',
      script: 'dist/index.js',
      cwd: '/root/tg-beauty/backend',

      // Переменные окружения читаются из файла .env в корне проекта
      env_file: '/root/tg-beauty/.env',

      // Автоматический перезапуск при сбое
      restart_delay: 3000,
      max_restarts: 10,

      // Логи
      out_file: '/var/log/beauty-backend.log',
      error_file: '/var/log/beauty-backend.error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
