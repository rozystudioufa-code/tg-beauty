import { FastifyInstance } from 'fastify';
import { supabase } from '../supabase';
import { sendMessage } from '../services/botApi';

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { id: number; first_name: string; username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string };
    data?: string;
    message?: { chat: { id: number } };
  };
}

export async function webhookRoutes(app: FastifyInstance) {

  // ── POST /v1/webhook/bot/:masterId ───────────────────────────────────
  // Сюда Telegram шлёт все обновления от бота конкретного мастера
  app.post<{ Params: { masterId: string }; Body: TelegramUpdate }>(
    '/webhook/bot/:masterId',
    async (request, reply) => {
      const { masterId } = request.params;
      const update = request.body;

      // Получаем данные мастера (токен бота и имя бота)
      const { data: master } = await supabase
        .from('masters')
        .select('id, name, bot_token, bot_username, address')
        .eq('id', masterId)
        .maybeSingle();

      // Неизвестный мастер — просто игнорируем
      if (!master?.bot_token) {
        return reply.code(200).send({ ok: true });
      }

      const token = master.bot_token;
      const msg = update.message;

      if (!msg?.text) {
        return reply.code(200).send({ ok: true });
      }

      const chatId = msg.chat.id;
      const text = msg.text.trim();
      const isMaster = msg.from?.id === await getMasterTelegramId(masterId);

      // /start — открыть Mini App
      if (text === '/start' || text.startsWith('/start ')) {
        const appUrl = `https://t.me/${master.bot_username}/app`;

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `Привет! Я помогу записаться к мастеру ${master.name} 💜\n\nНажми кнопку ниже чтобы открыть каталог услуг:`,
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '💜 Открыть каталог',
                  web_app: { url: appUrl },
                },
              ]],
            },
          }),
        });
        return reply.code(200).send({ ok: true });
      }

      // /mybookings — список записей клиента
      if (text === '/mybookings') {
        const clientId = msg.from?.id;
        if (!clientId) return reply.code(200).send({ ok: true });

        const { data: bookings } = await supabase
          .from('bookings')
          .select('service_name, booked_date, booked_slot, status')
          .eq('master_id', masterId)
          .eq('client_telegram_id', clientId)
          .eq('status', 'upcoming')
          .order('booked_date', { ascending: true })
          .limit(5);

        if (!bookings || bookings.length === 0) {
          await sendMessage(token, chatId, 'У вас нет предстоящих записей.\n\nЗапишитесь через каталог 👇');
        } else {
          const lines = bookings.map(b => {
            const date = new Date(b.booked_date).toLocaleDateString('ru-RU', {
              day: 'numeric', month: 'long',
            });
            return `📅 ${date} в ${b.booked_slot} — ${b.service_name}`;
          });
          await sendMessage(token, chatId, `Ваши предстоящие записи:\n\n${lines.join('\n')}`);
        }
        return reply.code(200).send({ ok: true });
      }

      // /help — инструкция
      if (text === '/help') {
        await sendMessage(
          token, chatId,
          `Как пользоваться:\n\n` +
          `▶️ /start — открыть каталог услуг\n` +
          `📋 /mybookings — мои записи\n` +
          `❓ /help — эта справка\n\n` +
          `По вопросам: @${master.bot_username}`
        );
        return reply.code(200).send({ ok: true });
      }

      // /master — режим управления (только для самого мастера)
      if (text === '/master' && isMaster) {
        const appUrl = `https://t.me/${master.bot_username}/app`;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '⚙️ Панель управления мастера:',
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '⚙️ Открыть панель управления',
                  web_app: { url: `${appUrl}?startapp=master_panel` },
                },
              ]],
            },
          }),
        });
        return reply.code(200).send({ ok: true });
      }

      return reply.code(200).send({ ok: true });
    }
  );
}

async function getMasterTelegramId(masterId: string): Promise<number | null> {
  const { data } = await supabase
    .from('masters')
    .select('telegram_id')
    .eq('id', masterId)
    .maybeSingle();
  return data?.telegram_id ?? null;
}
