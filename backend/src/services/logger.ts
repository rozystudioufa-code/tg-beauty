// ─── logger.ts ────────────────────────────────────────────────────────────────
// Централизованный логгер. Все ошибки пишутся с тегом — легко искать через grep.
// На сервере: pm2 logs beauty-backend | grep [AUTH]
// ─────────────────────────────────────────────────────────────────────────────

type Level = 'INFO' | 'WARN' | 'ERROR';

function write(level: Level, tag: string, message: string, extra?: unknown) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] [${tag}] ${message}`;

  if (extra !== undefined) {
    const detail = extra instanceof Error
      ? extra.message
      : typeof extra === 'object'
        ? JSON.stringify(extra)
        : String(extra);
    level === 'ERROR'
      ? console.error(line, '→', detail)
      : console.log(line, '→', detail);
  } else {
    level === 'ERROR' ? console.error(line) : console.log(line);
  }
}

export const log = {

  // ── Сервер ────────────────────────────────────────────────────────────
  serverStarted: (port: number) =>
    write('INFO', 'SERVER', `Запущен на порту ${port}`),

  serverCrash: (err: unknown) =>
    write('ERROR', 'SERVER', 'Критическая ошибка — сервер упал', err),

  // ── Авторизация ───────────────────────────────────────────────────────
  authOk: (telegramId: number, isMaster: boolean) =>
    write('INFO', 'AUTH', `Вход telegram_id=${telegramId} master=${isMaster}`),

  authFail: (reason: string, ip?: string) =>
    write('WARN', 'AUTH', `Отказ авторизации: ${reason}${ip ? ` ip=${ip}` : ''}`),

  // ── Записи ────────────────────────────────────────────────────────────
  bookingCreated: (bookingId: string, clientId: number, slot: string) =>
    write('INFO', 'BOOKING', `Создана booking_id=${bookingId} client=${clientId} slot=${slot}`),

  bookingSlotTaken: (masterId: string, date: string, slot: string) =>
    write('WARN', 'BOOKING', `Слот занят master=${masterId} ${date} ${slot}`),

  bookingError: (err: unknown) =>
    write('ERROR', 'BOOKING', 'Ошибка создания записи', err),

  bookingCancelled: (bookingId: string, clientId: number) =>
    write('INFO', 'BOOKING', `Отменена booking_id=${bookingId} client=${clientId}`),

  // ── База данных ───────────────────────────────────────────────────────
  dbError: (operation: string, err: unknown) =>
    write('ERROR', 'DB', `Ошибка: ${operation}`, err),

  // ── Webhook / бот ────────────────────────────────────────────────────
  webhookCmd: (masterId: string, cmd: string, userId: number) =>
    write('INFO', 'WEBHOOK', `/${cmd} masterId=${masterId} userId=${userId}`),

  webhookError: (masterId: string, err: unknown) =>
    write('ERROR', 'WEBHOOK', `Ошибка обработки webhook masterId=${masterId}`, err),

  webhookSet: (masterId: string, url: string) =>
    write('INFO', 'WEBHOOK', `Установлен для master=${masterId} url=${url}`),

  webhookFail: (masterId: string, err: unknown) =>
    write('ERROR', 'WEBHOOK', `Не удалось установить webhook master=${masterId}`, err),

  // ── Мастера и услуги ──────────────────────────────────────────────────
  masterRegistered: (masterId: string, botUsername: string) =>
    write('INFO', 'MASTER', `Зарегистрирован id=${masterId} bot=@${botUsername}`),

  serviceCreated: (serviceId: string, masterId: string) =>
    write('INFO', 'SERVICE', `Создана id=${serviceId} master=${masterId}`),

  // ── Общие ─────────────────────────────────────────────────────────────
  info:  (tag: string, msg: string, data?: unknown) => write('INFO',  tag, msg, data),
  warn:  (tag: string, msg: string, data?: unknown) => write('WARN',  tag, msg, data),
  error: (tag: string, msg: string, err?: unknown)  => write('ERROR', tag, msg, err),
};
