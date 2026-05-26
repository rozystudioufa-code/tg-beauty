import { FastifyInstance } from 'fastify';
import { supabase } from '../supabase';
import { requireAuth } from '../middleware/auth';

export async function serviceRoutes(app: FastifyInstance) {

  // ── GET /v1/masters/:id/services ────────────────────────────────────
  // Публичный список активных услуг мастера (для клиентов)
  app.get<{ Params: { id: string } }>(
    '/masters/:id/services',
    async (request, reply) => {
      const { id } = request.params;

      const { data, error } = await supabase
        .from('services')
        .select(`
          id, category, name, short_desc, description,
          price, duration_minutes, duration_label,
          emoji, gradient_from, gradient_to, accent_hex,
          before_img_url, after_img_url,
          cancel_policy, review_text, review_author, sort_order
        `)
        .eq('master_id', id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        return reply.code(500).send({ error: 'Ошибка загрузки услуг' });
      }

      return reply.send(data ?? []);
    }
  );

  // ── POST /v1/master/services ─────────────────────────────────────────
  // Создать услугу (только для мастера, лимит 5 на free)
  app.post<{
    Body: {
      category: string;
      name: string;
      short_desc?: string;
      description?: string;
      price: number;
      duration_minutes: number;
      duration_label?: string;
      emoji?: string;
      gradient_from?: string;
      gradient_to?: string;
      accent_hex?: string;
      cancel_policy?: string;
    };
  }>(
    '/master/services',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { telegram_id } = request.user;

      // Получаем мастера и его тариф
      const { data: master } = await supabase
        .from('masters')
        .select('id, subscription_tier')
        .eq('telegram_id', telegram_id)
        .maybeSingle();

      if (!master) {
        return reply.code(404).send({ error: 'Профиль мастера не найден' });
      }

      // Проверяем лимит услуг для free-тарифа
      if (master.subscription_tier === 'free') {
        const { count } = await supabase
          .from('services')
          .select('id', { count: 'exact', head: true })
          .eq('master_id', master.id)
          .eq('is_active', true);

        if ((count ?? 0) >= 5) {
          return reply.code(403).send({
            error: 'Достигнут лимит 5 услуг на тарифе Free',
            upgrade_required: true,
          });
        }
      }

      const {
        category, name, short_desc, description,
        price, duration_minutes, duration_label,
        emoji, gradient_from, gradient_to, accent_hex, cancel_policy,
      } = request.body;

      // Валидация обязательных полей
      if (!category || !name || !price || !duration_minutes) {
        return reply.code(400).send({
          error: 'Обязательные поля: category, name, price, duration_minutes',
        });
      }

      const validCategories = ['classic', 'volume', 'care', 'color'];
      if (!validCategories.includes(category)) {
        return reply.code(400).send({
          error: `category должен быть одним из: ${validCategories.join(', ')}`,
        });
      }

      // Определяем sort_order — добавляем в конец
      const { count: total } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', master.id);

      const { data: service, error: insertError } = await supabase
        .from('services')
        .insert({
          master_id: master.id,
          category,
          name,
          short_desc,
          description,
          price,
          duration_minutes,
          duration_label,
          emoji: emoji ?? '✨',
          gradient_from: gradient_from ?? '#dbeeff',
          gradient_to: gradient_to ?? '#b3d4f5',
          accent_hex: accent_hex ?? '#2a7fc2',
          cancel_policy: cancel_policy ?? 'Бесплатная отмена за 24 часа',
          sort_order: total ?? 0,
        })
        .select()
        .single();

      if (insertError || !service) {
        return reply.code(500).send({ error: 'Ошибка создания услуги' });
      }

      return reply.code(201).send(service);
    }
  );

  // ── PUT /v1/master/services/:id ──────────────────────────────────────
  // Обновить услугу
  app.put<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>(
    '/master/services/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { telegram_id } = request.user;
      const { id } = request.params;

      // Проверяем что услуга принадлежит этому мастеру
      const { data: existing } = await supabase
        .from('services')
        .select('id, master_id, masters!inner(telegram_id)')
        .eq('id', id)
        .maybeSingle();

      if (!existing) {
        return reply.code(404).send({ error: 'Услуга не найдена' });
      }

      const master = existing.masters as unknown as { telegram_id: number };
      if (master.telegram_id !== telegram_id) {
        return reply.code(403).send({ error: 'Нет доступа к этой услуге' });
      }

      const allowed = [
        'name', 'short_desc', 'description', 'price', 'duration_minutes',
        'duration_label', 'emoji', 'gradient_from', 'gradient_to',
        'accent_hex', 'cancel_policy', 'review_text', 'review_author',
        'before_img_url', 'after_img_url', 'is_active',
      ];

      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in request.body) {
          updates[key] = request.body[key];
        }
      }

      const { data: updated, error } = await supabase
        .from('services')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return reply.code(500).send({ error: 'Ошибка обновления услуги' });
      }

      return reply.send(updated);
    }
  );

  // ── DELETE /v1/master/services/:id ───────────────────────────────────
  // Деактивировать услугу (не удалять — история записей сохраняется)
  app.delete<{ Params: { id: string } }>(
    '/master/services/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { telegram_id } = request.user;
      const { id } = request.params;

      const { data: existing } = await supabase
        .from('services')
        .select('id, masters!inner(telegram_id)')
        .eq('id', id)
        .maybeSingle();

      if (!existing) {
        return reply.code(404).send({ error: 'Услуга не найдена' });
      }

      const master = existing.masters as unknown as { telegram_id: number };
      if (master.telegram_id !== telegram_id) {
        return reply.code(403).send({ error: 'Нет доступа к этой услуге' });
      }

      await supabase
        .from('services')
        .update({ is_active: false })
        .eq('id', id);

      return reply.code(200).send({ success: true });
    }
  );

  // ── PUT /v1/master/services/reorder ──────────────────────────────────
  // Изменить порядок отображения услуг
  app.put<{ Body: { order: string[] } }>(
    '/master/services/reorder',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { telegram_id } = request.user;
      const { order } = request.body;

      if (!Array.isArray(order) || order.length === 0) {
        return reply.code(400).send({ error: 'order должен быть массивом UUID' });
      }

      const { data: master } = await supabase
        .from('masters')
        .select('id')
        .eq('telegram_id', telegram_id)
        .maybeSingle();

      if (!master) {
        return reply.code(404).send({ error: 'Мастер не найден' });
      }

      // Обновляем sort_order для каждой услуги
      await Promise.all(
        order.map((serviceId, index) =>
          supabase
            .from('services')
            .update({ sort_order: index })
            .eq('id', serviceId)
            .eq('master_id', master.id)
        )
      );

      return reply.code(200).send({ success: true });
    }
  );
}
