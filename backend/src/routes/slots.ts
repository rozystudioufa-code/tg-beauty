import { FastifyInstance } from 'fastify';
import { supabase } from '../supabase';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function slotsOverlap(slotA: string, durA: number, slotB: string, durB: number): boolean {
  const a = timeToMinutes(slotA);
  const b = timeToMinutes(slotB);
  return a < b + durB && b < a + durA;
}

async function getAvailableSlots(masterId: string, date: string, durationMinutes: number) {
  // Расписание мастера
  const { data: schedule } = await supabase
    .from('schedule')
    .select('weekday_slots, weekend_slots')
    .eq('master_id', masterId)
    .maybeSingle();

  if (!schedule) return { slots: [], blocked: [] };

  const dayOfWeek = new Date(date).getUTCDay(); // 0=вс, 6=сб
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const allSlots: string[] = isWeekend ? schedule.weekend_slots : schedule.weekday_slots;

  // Существующие записи на эту дату
  const { data: bookings } = await supabase
    .from('bookings')
    .select('booked_slot, duration_minutes')
    .eq('master_id', masterId)
    .eq('booked_date', date)
    .eq('status', 'upcoming');

  const existing = bookings ?? [];

  const available: string[] = [];
  const blocked: string[] = [];

  for (const slot of allSlots) {
    const isBusy = existing.some(b =>
      slotsOverlap(slot, durationMinutes, b.booked_slot, b.duration_minutes)
    );
    if (isBusy) {
      blocked.push(slot);
    } else {
      available.push(slot);
    }
  }

  return { slots: available, blocked };
}

export async function slotRoutes(app: FastifyInstance) {

  // ── GET /v1/masters/:id/slots?date=2026-05-22&duration=120 ───────────
  app.get<{
    Params: { id: string };
    Querystring: { date?: string; duration?: string };
  }>(
    '/masters/:id/slots',
    async (request, reply) => {
      const { id } = request.params;
      const { date, duration } = request.query;

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return reply.code(400).send({ error: 'Параметр date обязателен (формат: YYYY-MM-DD)' });
      }

      if (new Date(date) < new Date(new Date().toISOString().split('T')[0])) {
        return reply.code(400).send({ error: 'Нельзя запросить слоты для прошедших дат' });
      }

      const durationMin = parseInt(duration ?? '60', 10);
      const result = await getAvailableSlots(id, date, durationMin);

      return reply.send({ date, ...result });
    }
  );

  // ── GET /v1/masters/:id/slots/next ───────────────────────────────────
  // Ближайший свободный слот в следующие 14 дней
  app.get<{ Params: { id: string }; Querystring: { duration?: string } }>(
    '/masters/:id/slots/next',
    async (request, reply) => {
      const { id } = request.params;
      const durationMin = parseInt(request.query.duration ?? '60', 10);

      const today = new Date();

      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];

        const { slots } = await getAvailableSlots(id, dateStr, durationMin);
        if (slots.length > 0) {
          return reply.send({ date: dateStr, slot: slots[0] });
        }
      }

      return reply.send({ date: null, slot: null });
    }
  );
}
