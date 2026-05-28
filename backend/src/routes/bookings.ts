import { FastifyInstance } from 'fastify';
import { supabase } from '../supabase';
import { requireAuth } from '../middleware/auth';
import { log } from '../services/logger';

export async function bookingRoutes(app: FastifyInstance) {

  // ── POST /v1/masters/:masterId/bookings ──────────────────────────────
  // Создать запись (атомарно через book_slot функцию)
  app.post<{
    Params: { masterId: string };
    Body: {
      service_id: string;
      date: string;
      slot: string;
      comment?: string;
    };
    Headers: { 'idempotency-key'?: string };
  }>(
    '/masters/:masterId/bookings',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const { masterId } = request.params;
      const { service_id, date, slot, comment } = request.body;
      const { telegram_id, name } = request.user;

      const idempotencyKey = request.headers['idempotency-key'];
      if (!idempotencyKey) {
        return reply.code(400).send({ error: 'Заголовок Idempotency-Key обязателен' });
      }

      if (!service_id || !date || !slot) {
        return reply.code(400).send({ error: 'Обязательные поля: service_id, date, slot' });
      }

      // Получаем данные услуги
      const { data: service } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes, duration_label, is_active')
        .eq('id', service_id)
        .eq('master_id', masterId)
        .maybeSingle();

      if (!service || !service.is_active) {
        return reply.code(404).send({ error: 'Услуга не найдена или недоступна' });
      }

      // Получаем данные мастера
      const { data: master } = await supabase
        .from('masters')
        .select('address_full, telegram_id, bot_token')
        .eq('id', masterId)
        .maybeSingle();

      // Вызываем атомарную функцию с защитой от race condition
      const { data: result, error } = await supabase.rpc('book_slot', {
        p_idempotency_key:    idempotencyKey,
        p_master_id:          masterId,
        p_client_telegram_id: telegram_id,
        p_client_name:        name,
        p_client_username:    null,
        p_service_id:         service_id,
        p_service_name:       service.name,
        p_price:              service.price,
        p_duration_minutes:   service.duration_minutes,
        p_duration_label:     service.duration_label,
        p_booked_date:        date,
        p_booked_slot:        slot,
        p_comment:            comment ?? '',
        p_address:            master?.address_full ?? '',
      });

      if (error) {
        log.bookingError(error);
        return reply.code(500).send({ error: 'Ошибка создания записи' });
      }

      if (result.error === 'slot_taken') {
        log.bookingSlotTaken(masterId, date, slot);
        return reply.code(409).send({
          error: 'slot_taken',
          message: 'Этот слот уже занят, выберите другое время',
        });
      }

      log.bookingCreated(result.booking_id, telegram_id, `${date} ${slot}`);

      // Уведомление мастеру в Telegram
      log.info('BOOKING', `Уведомление: status=${result.status} has_token=${!!master?.bot_token} has_tg=${!!master?.telegram_id}`);
      if (result.status !== 'existing' && master?.bot_token && master?.telegram_id) {
        const dateFormatted = new Date(date).toLocaleDateString('ru-RU', {
          day: 'numeric', month: 'long', weekday: 'short',
        });
        const msg =
          `📅 Новая запись!\n\n` +
          `👤 Клиент: ${name}\n` +
          `💅 Услуга: ${service.name}\n` +
          `🕐 Дата: ${dateFormatted}, ${slot}\n` +
          `⏱ Длительность: ${service.duration_label}\n` +
          `💰 Стоимость: ${service.price} ₽`;
        fetch(`https://api.telegram.org/bot${master.bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: master.telegram_id, text: msg }),
        }).then(r => r.json()).then(r => log.info('BOOKING', `Уведомление отправлено: ${JSON.stringify(r)}`)).catch(e => log.error('BOOKING', 'Ошибка уведомления', e));
      }

      return reply.code(result.status === 'existing' ? 200 : 201).send({
        booking_id:   result.booking_id,
        status:       'upcoming',
        service_name: service.name,
        date,
        slot,
        address: master?.address_full ?? '',
      });
    }
  );

  // ── GET /v1/client/bookings ──────────────────────────────────────────
  // Все записи клиента
  app.get(
    '/client/bookings',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { telegram_id } = request.user;

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, service_name, price, duration_label,
          booked_date, booked_slot, comment, address, status,
          cancelled_at, created_at
        `)
        .eq('client_telegram_id', telegram_id)
        .order('booked_date', { ascending: false });

      if (error) {
        return reply.code(500).send({ error: 'Ошибка загрузки записей' });
      }

      return reply.send(data ?? []);
    }
  );

  // ── DELETE /v1/client/bookings/:id ───────────────────────────────────
  // Отменить запись
  app.delete<{ Params: { id: string } }>(
    '/client/bookings/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { telegram_id } = request.user;
      const { id } = request.params;

      const { data: booking } = await supabase
        .from('bookings')
        .select('id, client_telegram_id, status, master_id')
        .eq('id', id)
        .maybeSingle();

      if (!booking) {
        return reply.code(404).send({ error: 'Запись не найдена' });
      }

      if (booking.client_telegram_id !== telegram_id) {
        return reply.code(403).send({ error: 'Нет доступа к этой записи' });
      }

      if (booking.status !== 'upcoming') {
        return reply.code(400).send({ error: 'Можно отменить только предстоящую запись' });
      }

      await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', id);

      return reply.code(200).send({ success: true });
    }
  );

  // ── GET /v1/master/bookings ──────────────────────────────────────────
  // Все записи к мастеру (только для мастера)
  app.get<{ Querystring: { status?: string; date?: string } }>(
    '/master/bookings',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { telegram_id } = request.user;
      const { status, date } = request.query;

      const { data: master } = await supabase
        .from('masters')
        .select('id')
        .eq('telegram_id', telegram_id)
        .maybeSingle();

      if (!master) {
        return reply.code(403).send({ error: 'Только для мастеров' });
      }

      let query = supabase
        .from('bookings')
        .select(`
          id, client_name, client_username, client_telegram_id,
          service_name, price, duration_label,
          booked_date, booked_slot, comment, status, created_at
        `)
        .eq('master_id', master.id)
        .order('booked_date', { ascending: true });

      if (status) query = query.eq('status', status);
      if (date)   query = query.eq('booked_date', date);

      const { data, error } = await query;

      if (error) {
        return reply.code(500).send({ error: 'Ошибка загрузки записей' });
      }

      return reply.send(data ?? []);
    }
  );
}
