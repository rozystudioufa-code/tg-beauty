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

const app = Fastify({ logger: true });

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
    console.log('Сервер запущен на порту 3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
