import { FastifyInstance } from 'fastify';
import { validateInitData } from '../services/telegram';
import { signAccessToken } from '../services/jwt';
import { supabase } from '../supabase';
import { log } from '../services/logger';

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/validate — вход через Telegram initData
  app.post<{ Body: { init_data: string } }>(
    '/auth/validate',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const { init_data } = request.body;

      if (!init_data) {
        return reply.code(400).send({ error: 'init_data обязателен' });
      }

      const botToken = process.env.BOT_TOKEN;
      if (!botToken) {
        return reply.code(500).send({ error: 'Токен бота не настроен на сервере' });
      }

      // Проверяем подпись Telegram
      const result = validateInitData(init_data, botToken);
      if (!result.valid || !result.user) {
        log.authFail('Неверная подпись Telegram', request.ip);
        return reply.code(401).send({ error: 'Неверная подпись Telegram' });
      }

      const { user } = result;

      // Проверяем — зарегистрирован ли этот пользователь как мастер
      const { data: master } = await supabase
        .from('masters')
        .select('id')
        .eq('telegram_id', user.id)
        .maybeSingle();

      const isMaster = !!master;

      const access_token = signAccessToken({
        telegram_id: user.id,
        name: user.first_name,
        is_master: isMaster,
        master_id: master?.id,
      });

      log.authOk(user.id, isMaster);
      return reply.code(200).send({
        access_token,
        is_master: isMaster,
        master_id: master?.id ?? null,
      });
    }
  );
}
