import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

import { authRoutes } from './routes/auth';
import { masterRoutes } from './routes/masters';
import { serviceRoutes } from './routes/services';
import { slotRoutes } from './routes/slots';
import { bookingRoutes } from './routes/bookings';
import { webhookRoutes } from './routes/webhook';
import { log } from './services/logger';

const app = Fastify({ logger: false }); // логи пишем через log.*

// ── Глобальный хук: логируем все 5xx ошибки ──────────────────────────────────
app.addHook('onError', (_request, _reply, error, done) => {
  log.error('SERVER', `Необработанная ошибка: ${error.message}`, error.stack);
  done();
});

// ── Глобальный хук: логируем медленные запросы (> 3 сек) ─────────────────────
app.addHook('onResponse', (request, reply, done) => {
  const ms = Math.round(reply.elapsedTime);
  if (ms > 3000) {
    log.warn('PERF', `Медленный запрос ${request.method} ${request.url} — ${ms}ms`);
  }
  done();
});

// ── Перехватываем необработанные исключения ───────────────────────────────────
process.on('uncaughtException', (err) => {
  log.serverCrash(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('SERVER', 'Unhandled Promise rejection', reason);
});

const start = async () => {
  await app.register(cors, { origin: '*' });
  await app.register(rateLimit, { global: false });

  // Маршруты
  await app.register(authRoutes, { prefix: '/v1' });
  await app.register(masterRoutes, { prefix: '/v1' });
  await app.register(serviceRoutes, { prefix: '/v1' });
  await app.register(slotRoutes, { prefix: '/v1' });
  await app.register(bookingRoutes, { prefix: '/v1' });
  await app.register(webhookRoutes, { prefix: '/v1' });

  // Проверка работоспособности
  app.get('/health', async () => ({
    status: 'ok',
    time: new Date().toISOString(),
  }));

  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    log.serverStarted(3000);
  } catch (err) {
    log.serverCrash(err);
    process.exit(1);
  }
};

start();
