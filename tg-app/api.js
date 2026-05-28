// ─── api.js ──────────────────────────────────────────────────────────────────
// API-клиент. Когда API_URL пустой — приложение работает локально (localStorage).
// После деплоя бэкенда на Railway:
//   1. API_URL  = 'https://ваш-домен.railway.app'
//   2. MASTER_ID = 'uuid из базы данных после регистрации мастера'
// ─────────────────────────────────────────────────────────────────────────────

const API_URL   = 'https://beautybook24.ru';
const MASTER_ID = '1f459c56-ccb6-44ef-af40-757444949708';

// ─── Внутреннее состояние ────────────────────────────────────────────────────
let _jwt      = localStorage.getItem('tg_beauty_jwt') || null;
let _masterId = null;

// ─── Определяем master_id ────────────────────────────────────────────────────
// Порядок: deep link startapp → константа MASTER_ID → null (локальный режим)
function resolveMasterId() {
  const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (startParam?.startsWith('master_')) return startParam.slice(7);
  return MASTER_ID || null;
}

// ─── Инициализация: получаем JWT от сервера ──────────────────────────────────
async function initApi() {
  _masterId = resolveMasterId();

  if (!API_URL) return; // нет сервера — работаем локально

  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) return; // браузер без Telegram — пропускаем авторизацию

  try {
    const res = await fetch(`${API_URL}/v1/auth/validate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ init_data: initData }),
    });

    if (!res.ok) return;

    const data = await res.json();
    _jwt = data.access_token;
    localStorage.setItem('tg_beauty_jwt', _jwt);

    if (data.is_master) {
      state.isMaster  = true;
      state.masterApiId = data.master_id;
    }
  } catch (e) {
    console.warn('[API] Недоступен, работаем локально:', e.message);
  }
}

// ─── Fetch с авторизацией ────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(_jwt ? { 'Authorization': `Bearer ${_jwt}` } : {}),
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      _jwt = null;
      localStorage.removeItem('tg_beauty_jwt');
      return null;
    }

    return res.ok ? res.json() : null;
  } catch (e) {
    console.warn('[API] Ошибка запроса:', path, e.message);
    return null;
  }
}

// ─── Нормализация: API → формат который ожидает app.js ───────────────────────
function normalizeService(s) {
  return {
    id:            s.id,           // UUID из БД
    category:      s.category,
    name:          s.name,
    shortDesc:     s.short_desc,
    description:   s.description,
    duration:      s.duration_minutes,
    durationLabel: s.duration_label,
    price:         s.price,
    deposit:       0,
    emoji:         s.emoji        || '✨',
    gradientFrom:  s.gradient_from || '#dbeeff',
    gradientTo:    s.gradient_to   || '#b3d4f5',
    beforeFrom:    '#f5efe6',
    beforeTo:      '#e5d5c5',
    beforeImg:     s.before_img_url || null,
    afterImg:      s.after_img_url  || null,
    cancelPolicy:  s.cancel_policy  || 'Бесплатная отмена за 24 часа',
    review:        s.review_text ? { text: s.review_text, author: s.review_author } : null,
  };
}

function normalizeMaster(m) {
  return {
    name:        m.name,
    tagline:     m.tagline        || 'Мастер по наращиванию ресниц',
    status:      m.status_text    || 'Принимаю клиентов',
    statusActive: m.status_active,
    address:     m.address,
    addressFull: m.address_full,
    experience:  m.experience,
    telegram:    m.telegram_handle,
    photo:       m.photo_url      || 'images/master.png',
  };
}

function normalizeBooking(b) {
  return {
    id:          b.id,
    serviceId:   b.service_id,
    serviceName: b.service_name,
    price:       b.price,
    duration:    b.duration_label,
    date:        b.booked_date,   // строка YYYY-MM-DD
    slot:        b.booked_slot ? b.booked_slot.slice(0, 5) : '',
    comment:     b.comment || '',
    address:     b.address || '',
    status:      b.status,
    fromApi:     true,            // флаг чтобы отличить от localStorage записей
  };
}

// ─── Публичные функции ───────────────────────────────────────────────────────

async function apiGetMaster() {
  if (!_masterId) return null;
  const data = await apiFetch(`/v1/masters/${_masterId}`);
  return data ? normalizeMaster(data) : null;
}

async function apiGetServices() {
  if (!_masterId) return null;
  const data = await apiFetch(`/v1/masters/${_masterId}/services`);
  return data ? data.map(normalizeService) : null;
}

async function apiGetSlots(date, durationMinutes) {
  if (!_masterId) return null;
  const data = await apiFetch(`/v1/masters/${_masterId}/slots?date=${date}&duration=${durationMinutes}`);
  return data ? { available: data.slots || [], blocked: data.blocked || [] } : null;
}

async function apiCreateBooking(bookingData) {
  if (!_masterId || !_jwt) return null;
  const idempotencyKey = crypto.randomUUID();
  return apiFetch(`/v1/masters/${_masterId}/bookings`, {
    method:  'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body:    JSON.stringify(bookingData),
  });
}

async function apiGetClientBookings() {
  if (!_jwt) return null;
  const data = await apiFetch('/v1/client/bookings');
  return data ? data.map(normalizeBooking) : null;
}

async function apiCancelBooking(bookingId) {
  if (!_jwt) return null;
  return apiFetch(`/v1/client/bookings/${bookingId}`, { method: 'DELETE' });
}
