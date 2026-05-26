import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const sql = `
CREATE OR REPLACE FUNCTION book_slot(
  p_idempotency_key      UUID,
  p_master_id            UUID,
  p_client_telegram_id   BIGINT,
  p_client_name          TEXT,
  p_client_username      TEXT,
  p_service_id           UUID,
  p_service_name         TEXT,
  p_price                INTEGER,
  p_duration_minutes     INTEGER,
  p_duration_label       TEXT,
  p_booked_date          DATE,
  p_booked_slot          TIME,
  p_comment              TEXT,
  p_address              TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_overlap_count INTEGER;
  v_booking_id    UUID;
BEGIN
  SELECT id INTO v_booking_id
  FROM bookings WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('booking_id', v_booking_id, 'status', 'existing');
  END IF;

  PERFORM id FROM bookings
  WHERE master_id = p_master_id
    AND booked_date = p_booked_date
    AND status = 'upcoming'
  FOR UPDATE;

  SELECT COUNT(*) INTO v_overlap_count
  FROM bookings
  WHERE master_id   = p_master_id
    AND booked_date = p_booked_date
    AND status      = 'upcoming'
    AND booked_slot < (p_booked_slot + (p_duration_minutes || ' minutes')::interval)::time
    AND (booked_slot + (duration_minutes || ' minutes')::interval)::time > p_booked_slot;

  IF v_overlap_count > 0 THEN
    RETURN jsonb_build_object('error', 'slot_taken');
  END IF;

  INSERT INTO bookings (
    idempotency_key, master_id,
    client_telegram_id, client_name, client_username,
    service_id, service_name, price, duration_minutes, duration_label,
    booked_date, booked_slot, comment, address
  ) VALUES (
    p_idempotency_key, p_master_id,
    p_client_telegram_id, p_client_name, p_client_username,
    p_service_id, p_service_name, p_price, p_duration_minutes, p_duration_label,
    p_booked_date, p_booked_slot, p_comment, p_address
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('booking_id', v_booking_id, 'status', 'created');
END;
$$;
`;

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('Подключение к базе данных...');
    await client.query(sql);
    console.log('✅ Функция book_slot создана успешно');
  } catch (err) {
    console.error('❌ Ошибка:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
