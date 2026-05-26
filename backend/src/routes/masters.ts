import { FastifyInstance } from 'fastify';
import { supabase } from '../supabase';
import { requireAuth } from '../middleware/auth';
import { getBotInfo, setWebhook, setBotCommands } from '../services/botApi';

export async function masterRoutes(app: FastifyInstance) {

  // ── GET /v1/masters/:id ──────────────────────────────────────────────
  // Публичный профиль мастера (для клиентского Mini App)
  app.get<{ Params: { id: string } }>(
    '/masters/:id',
    async (request, reply) => {
      const { id } = request.params;

      const { data: master, error } = await supabase
        .from('masters')
        .select(`
          id, name, tagline, address, address_full,
          experience, photo_url, status_text, status_active,
          telegram_handle, theme_accent, theme_bg, subscription_tier
        `)
        .eq('id', id)
        .single();

      if (error || !master) {
        return reply.code(404).send({ error: 'Мастер не найден' });
      }

      return reply.send({
        ...master,
        theme: {
          accent: master.theme_accent,
          bg: master.theme_bg,
        },
      });
    }
  );

  // ── POST /v1/master/register ─────────────────────────────────────────
  // Регистрация мастера — вводит токен своего бота
  app.post<{ Body: { bot_token: string } }>(
    '/master/register',
    {
      preHandler: requireAuth,
      config: {
        rateLimit: { max: 3, timeWindow: '1 hour' },
      },
    },
    async (request, reply) => {
      const { bot_token } = request.body;
      const { telegram_id, name } = request.user;

      if (!bot_token || typeof bot_token !== 'string') {
        return reply.code(400).send({ error: 'bot_token обязателен' });
      }

      // Проверяем — нет ли уже мастера с таким telegram_id
      const { data: existing } = await supabase
        .from('masters')
        .select('id')
        .eq('telegram_id', telegram_id)
        .maybeSingle();

      if (existing) {
        return reply.code(409).send({ error: 'Вы уже зарегистрированы как мастер' });
      }

      // Проверяем — не занят ли токен другим мастером
      const { data: tokenUsed } = await supabase
        .from('masters')
        .select('id')
        .eq('bot_token', bot_token)
        .maybeSingle();

      if (tokenUsed) {
        return reply.code(409).send({ error: 'Этот бот уже подключён к другому аккаунту' });
      }

      // Проверяем токен через Telegram API
      const botInfo = await getBotInfo(bot_token);
      if (!botInfo) {
        return reply.code(400).send({ error: 'Неверный токен бота. Проверьте токен у @BotFather' });
      }

      // Создаём запись мастера
      const { data: master, error: insertError } = await supabase
        .from('masters')
        .insert({
          telegram_id,
          name,
          bot_token,
          bot_username: botInfo.username,
          webhook_set: false,
        })
        .select('id, name, bot_username')
        .single();

      if (insertError || !master) {
        return reply.code(500).send({ error: 'Ошибка создания профиля' });
      }

      // Создаём расписание по умолчанию
      await supabase.from('schedule').insert({ master_id: master.id });

      // Устанавливаем webhook и команды бота
      const serverUrl = process.env.SERVER_URL;
      let webhookSet = false;

      if (serverUrl) {
        const webhookUrl = `${serverUrl}/v1/webhook/bot/${master.id}`;
        webhookSet = await setWebhook(bot_token, webhookUrl);
        if (webhookSet) {
          await setBotCommands(bot_token);
          await supabase
            .from('masters')
            .update({ webhook_set: true })
            .eq('id', master.id);
        }
      }

      return reply.code(201).send({
        master_id: master.id,
        bot_username: master.bot_username,
        webhook_set: webhookSet,
        message: webhookSet
          ? 'Бот подключён! Заполните профиль и добавьте услуги.'
          : 'Мастер создан. Webhook будет установлен после деплоя сервера.',
      });
    }
  );

  // ── PUT /v1/master/profile ───────────────────────────────────────────
  // Обновление профиля мастера
  app.put<{
    Body: {
      name?: string;
      tagline?: string;
      address?: string;
      address_full?: string;
      experience?: string;
      status_text?: string;
      status_active?: boolean;
      telegram_handle?: string;
    };
  }>(
    '/master/profile',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { telegram_id } = request.user;

      const { data: master } = await supabase
        .from('masters')
        .select('id')
        .eq('telegram_id', telegram_id)
        .maybeSingle();

      if (!master) {
        return reply.code(404).send({ error: 'Профиль мастера не найден' });
      }

      const allowed = [
        'name', 'tagline', 'address', 'address_full',
        'experience', 'status_text', 'status_active', 'telegram_handle',
      ];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in request.body) {
          updates[key] = (request.body as Record<string, unknown>)[key];
        }
      }

      const { data: updated, error } = await supabase
        .from('masters')
        .update(updates)
        .eq('id', master.id)
        .select('id, name, tagline, address, status_text, status_active')
        .single();

      if (error) {
        return reply.code(500).send({ error: 'Ошибка обновления профиля' });
      }

      return reply.send(updated);
    }
  );
}
