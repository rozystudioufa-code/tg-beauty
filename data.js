// ─── data.js ────────────────────────────────────────────────────────────────
// Все данные приложения: мастер, услуги, категории, генерация слотов.
// Чтобы сменить мастера — редактируй объект MASTER.
// Чтобы добавить/убрать услугу — редактируй массив SERVICES.
// ────────────────────────────────────────────────────────────────────────────

// ─── Мастер ──────────────────────────────────────────────────────────────────
const MASTER = {
  name: 'Разиля Сунгатова',
  tagline: 'Мастер по наращиванию ресниц',
  status: 'Принимаю клиентов',
  statusActive: true,
  address: 'Уфа, ул. Жукова, 10',
  addressFull: 'г. Уфа, ул. Жукова, д. 10, бутик 2172',
  experience: '5 лет',
  telegram: 'razilyawb',
  photo: 'master.png',
  review: {
    text: 'Хожу к Разиле уже 2 года. Ресницы держатся 4 недели без коррекции!',
    author: 'Марина К.',
  },
};

// ─── Категории ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',     label: 'Все' },
  { id: 'classic', label: 'Классика' },
  { id: 'volume',  label: 'Объём' },
  { id: 'care',    label: 'Коррекция' },
];

// ─── Услуги ───────────────────────────────────────────────────────────────────
// duration — длительность в минутах
// deposit  — депозит в рублях (0 = без депозита)
// gradient — [светлый, тёмный] для CSS linear-gradient карточки
const SERVICES = [
  {
    id: 1,
    category: 'classic',
    name: 'Естественный шик (Классика)',
    shortDesc: 'Классика — природный взгляд на каждый день',
    description:
      'Каждый натуральный волосок удлиняется одним искусственным. ' +
      'Результат — ухоженный, природный взгляд без излишней пышности. ' +
      'Подходит для ежедневного ношения и чувствительных глаз. ' +
      'Работаю без запаха клея — безопасно для аллергиков.',
    duration: 120,
    price: 2000,
    deposit: 0,
    durationLabel: '2 часа',
    emoji: '✨',
    gradientFrom: '#dbeeff',
    gradientTo: '#b3d4f5',
    accentHex: '#2a7fc2',
    beforeFrom: '#f5efe6',
    beforeTo: '#e5d5c5',
    beforeImg: null,
    afterImg: 'klassika.png',
    cancelPolicy: 'Бесплатная отмена за 24 часа до визита',
    review: { text: 'Очень естественно, коллеги не поняли, что это наращивание!', author: 'Юля М.' },
  },
  {
    id: 2,
    category: 'volume',
    name: 'Лёгкая дымка (2D)',
    shortDesc: '2D — едва уловимый объём',
    description:
      'На каждый натуральный волосок крепятся 2 тонкие реснички. ' +
      'Взгляд становится чуть более выразительным и объёмным, ' +
      'при этом смотрится абсолютно естественно. ' +
      'Идеальный выбор тех, кто хочет чуть больше, чем классика. Держатся 3–4 недели.',
    duration: 150,
    price: 2200,
    deposit: 0,
    durationLabel: '2,5 часа',
    emoji: '💜',
    gradientFrom: '#ede5ff',
    gradientTo: '#d4b8f0',
    accentHex: '#7b4fd4',
    beforeFrom: '#f5efe6',
    beforeTo: '#e5d5c5',
    beforeImg: 'before-2D.PNG',
    afterImg:  'after-2D.PNG',
    cancelPolicy: 'Бесплатная отмена за 24 часа до визита',
    review: { text: 'Хожу на 2D уже год — держатся 3–4 недели, выгляжу всегда свежо.', author: 'Алина Р.' },
  },
  {
    id: 3,
    category: 'volume',
    name: 'Мягкая роскошь (3D)',
    shortDesc: '3D — мягкий пышный объём',
    description:
      'На каждый натуральный волосок крепятся 3 тонкие реснички. ' +
      'Взгляд становится заметно объёмным и женственным, но без излишней тяжести. ' +
      'Отличный вариант для тех, кто хочет выразительности каждый день. ' +
      'Реснички ультратонкие — не нагружают натуральные волоски.',
    duration: 180,
    price: 2300,
    deposit: 0,
    durationLabel: '3 часа',
    emoji: '🌸',
    gradientFrom: '#ffe5f0',
    gradientTo: '#f0b8d4',
    accentHex: '#d4257a',
    beforeFrom: '#f5efe6',
    beforeTo: '#e5d5c5',
    beforeImg: 'before-3D.PNG',
    afterImg:  'after-3D.PNG',
    cancelPolicy: 'Бесплатная отмена за 24 часа до визита',
    review: { text: 'На свадьбу делала 3D — на всех фото глаза просто огонь!', author: 'Катя В.' },
  },
  {
    id: 4,
    category: 'volume',
    name: 'Стильный объём (4D)',
    shortDesc: '4D — насыщенный выразительный взгляд',
    description:
      'Четыре тонкие реснички на каждый натуральный волосок. ' +
      'Взгляд становится ярким, насыщенным, притягивающим внимание. ' +
      'Идеально для особых случаев или тех, кто любит makeup-эффект каждый день. ' +
      'Используются ультратонкие реснички 0.05–0.07 мм для лёгкости.',
    duration: 180,
    price: 2500,
    deposit: 0,
    durationLabel: '3 часа',
    emoji: '⭐',
    gradientFrom: '#fff3d6',
    gradientTo: '#ffd980',
    accentHex: '#c47f00',
    beforeFrom: '#f5efe6',
    beforeTo: '#e5d5c5',
    beforeImg: 'before-4D.jpg',
    afterImg:  'after-4D.PNG',
    cancelPolicy: 'Бесплатная отмена за 24 часа до визита',
    review: { text: 'Такого объёма я нигде больше не нашла. Работа идеальная!', author: 'Настя Д.' },
  },
  {
    id: 5,
    category: 'care',
    name: 'Поддержание объёма (Коррекция 2-3D)',
    shortDesc: 'Коррекция 2-3D — обновление через 3–4 недели',
    description:
      'Коррекция выполняется через 3–4 недели после наращивания. ' +
      'Снимаются отросшие реснички, добавляются новые на освободившиеся волоски. ' +
      'Результат — как после полного наращивания. ' +
      'Обязательно иметь минимум 40% ресниц от предыдущего раза.',
    duration: 120,
    price: 1500,
    deposit: 0,
    durationLabel: '2 часа',
    emoji: '💎',
    gradientFrom: '#d6f5f0',
    gradientTo: '#a8e8dc',
    accentHex: '#00897b',
    beforeFrom: '#fff3d6',
    beforeTo: '#ffd980',
    beforeImg: null,
    afterImg: null,
    cancelPolicy: 'Бесплатная отмена за 24 часа до визита',
    review: { text: 'Коррекция занимает столько же — зато ресницы снова как новые!', author: 'Вика С.' },
  },
];

// ─── Слоты ────────────────────────────────────────────────────────────────────
// Будни: два слота; суббота и воскресенье: один слот в 12:00
const WEEKDAY_SLOTS  = ['09:00', '12:00']; // пн–пт
const WEEKEND_SLOTS  = ['12:00'];          // сб–вс

/**
 * Возвращает доступные слоты на дату с учётом уже сохранённых записей.
 * Слот блокируется если он уже занят или попадает в окно другой записи.
 * @param {Date} date
 * @returns {string[]}
 */
function getAvailableSlots(date) {
  const dow = date.getDay();
  const allSlots = (dow === 0 || dow === 6) ? WEEKEND_SLOTS : WEEKDAY_SLOTS;

  const dayBookings = loadBookings().filter(b => {
    const bd = new Date(b.date);
    return bd.getFullYear() === date.getFullYear()
        && bd.getMonth()    === date.getMonth()
        && bd.getDate()     === date.getDate()
        && b.status !== 'cancelled';
  });

  if (dayBookings.length === 0) return allSlots;

  return allSlots.filter(slot => {
    const [h, m]  = slot.split(':').map(Number);
    const slotMin = h * 60 + m;

    return !dayBookings.some(b => {
      const [bh, bm] = b.slot.split(':').map(Number);
      const bStart   = bh * 60 + bm;
      const bEnd     = bStart + (b.durationMinutes || 120);
      return slotMin >= bStart && slotMin < bEnd;
    });
  });
}

/**
 * Ближайший свободный слот среди следующих 14 дней.
 * @returns {{ date: Date, slot: string } | null}
 */
function getNextAvailableSlot() {
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const slots = getAvailableSlots(d);
    if (slots.length > 0) return { date: d, slot: slots[0] };
  }
  return null;
}

// ─── LocalStorage: мои записи ─────────────────────────────────────────────────
const STORAGE_KEY = 'tg_beauty_bookings';

function saveBooking(booking) {
  const list = loadBookings();
  list.unshift({ ...booking, id: Date.now(), createdAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadBookings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function cancelBooking(id) {
  const list = loadBookings().filter(b => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
