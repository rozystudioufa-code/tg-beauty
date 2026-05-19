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
  address: 'Уфа, ул. Революционная, 37',
  addressFull: 'г. Уфа, ул. Революционная, д. 37, кв. 12',
  experience: '5 лет',
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
  { id: 'color',   label: 'Цветное' },
  { id: 'care',    label: 'Уход' },
];

// ─── Услуги ───────────────────────────────────────────────────────────────────
// duration — длительность в минутах
// deposit  — депозит в рублях (0 = без депозита)
// gradient — [светлый, тёмный] для CSS linear-gradient карточки
const SERVICES = [
  {
    id: 1,
    category: 'classic',
    name: 'Классика 1:1',
    shortDesc: 'Естественный взгляд на каждый день',
    description:
      'Каждый натуральный волосок удлиняется одним искусственным. ' +
      'Результат — ухоженный, природный взгляд без излишней пышности. ' +
      'Подходит для ежедневного ношения и чувствительных глаз. ' +
      'Работаю без запаха клея — безопасно для аллергиков.',
    duration: 90,
    price: 2500,
    deposit: 500,
    durationLabel: '1,5 часа',
    emoji: '✨',
    gradientFrom: '#dbeeff',
    gradientTo: '#b3d4f5',
    accentHex: '#2a7fc2',
    beforeFrom: '#f5efe6',
    beforeTo: '#e5d5c5',
    cancelPolicy: 'Бесплатная отмена за 24 часа до визита',
    review: { text: 'Очень естественно, коллеги не поняли, что это наращивание!', author: 'Юля М.' },
  },
  {
    id: 2,
    category: 'volume',
    name: 'Объём 2D–3D',
    shortDesc: 'Густой натуральный объём',
    description:
      'На каждый натуральный волосок крепится пучок из 2–3 тонких ресничек. ' +
      'Взгляд становится выразительным и объёмным, при этом смотрится естественно. ' +
      'Идеальный вариант для тех, кто хочет больше, чем классика, ' +
      'но не готов к голливудскому эффекту. Держатся 3–4 недели.',
    duration: 120,
    price: 3200,
    deposit: 700,
    durationLabel: '2 часа',
    emoji: '💜',
    gradientFrom: '#ede5ff',
    gradientTo: '#d4b8f0',
    accentHex: '#7b4fd4',
    beforeFrom: '#f5efe6',
    beforeTo: '#e5d5c5',
    cancelPolicy: 'Бесплатная отмена за 24 часа до визита',
    review: { text: 'Хожу на 2D уже год — держатся 3–4 недели, выгляжу всегда свежо.', author: 'Алина Р.' },
  },
  {
    id: 3,
    category: 'volume',
    name: 'Объём 4D–5D',
    shortDesc: 'Выразительный голливудский взгляд',
    description:
      'Пышный объём из 4–5 тонких ресничек на каждый волосок. ' +
      'Взгляд становится драматичным и ярким. Идеально для особых случаев ' +
      'или тех, кто любит насыщенный makeup-эффект каждый день. ' +
      'Используются ультратонкие реснички 0.05–0.07 мм для лёгкости.',
    duration: 150,
    price: 4000,
    deposit: 800,
    durationLabel: '2,5 часа',
    emoji: '🌸',
    gradientFrom: '#ffe5f0',
    gradientTo: '#f0b8d4',
    accentHex: '#d4257a',
    beforeFrom: '#f5efe6',
    beforeTo: '#e5d5c5',
    cancelPolicy: 'Бесплатная отмена за 24 часа до визита',
    review: { text: 'На свадьбу делала 5D — на всех фото глаза просто огонь!', author: 'Катя В.' },
  },
  {
    id: 4,
    category: 'volume',
    name: 'Мегаобъём 6D+',
    shortDesc: 'Максимальная пышность и густота',
    description:
      'Максимальный объём — 6 и более ультратонких ресниц на каждый волосок. ' +
      'Взгляд невероятно пышный и насыщенный. Реснички 0.03–0.05 мм почти невесомые, ' +
      'не нагружают натуральные волоски. ' +
      'Рекомендована коррекция каждые 2–3 недели для поддержания формы.',
    duration: 180,
    price: 5000,
    deposit: 1000,
    durationLabel: '3 часа',
    emoji: '⭐',
    gradientFrom: '#fff3d6',
    gradientTo: '#ffd980',
    accentHex: '#c47f00',
    beforeFrom: '#f5efe6',
    beforeTo: '#e5d5c5',
    cancelPolicy: 'Бесплатная отмена за 24 часа до визита',
    review: { text: 'Такого объёма я нигде больше не нашла. Работа идеальная!', author: 'Настя Д.' },
  },
  {
    id: 5,
    category: 'color',
    name: 'Цветное наращивание',
    shortDesc: 'Яркий акцент или нежный цвет',
    description:
      'Цветные реснички для смелых и ярких образов. ' +
      'Можно сделать полностью цветной объём или добавить ' +
      'несколько цветных ресничек как акцент к чёрным. ' +
      'Доступные оттенки: синий, фиолетовый, бордо, розовый, зелёный.',
    duration: 150,
    price: 3500,
    deposit: 700,
    durationLabel: '2,5 часа',
    emoji: '🎨',
    gradientFrom: '#d6f5e8',
    gradientTo: '#a8e8c8',
    accentHex: '#1a9960',
    beforeFrom: '#f5efe6',
    beforeTo: '#e5d5c5',
    cancelPolicy: 'Бесплатная отмена за 24 часа до визита',
    review: { text: 'Сделала синие ресницы — все спрашивают, где делала. Это огонь!', author: 'Дарья К.' },
  },
  {
    id: 6,
    category: 'care',
    name: 'Снятие ресниц',
    shortDesc: 'Бережное профессиональное снятие',
    description:
      'Профессиональное безопасное снятие наращённых ресниц ' +
      'специальным нейтрализующим гелем без боли и без повреждений. ' +
      'Натуральные волоски остаются целы. ' +
      'Занимает около 30 минут. Депозит не требуется.',
    duration: 30,
    price: 500,
    deposit: 0,
    durationLabel: '30 минут',
    emoji: '🌿',
    gradientFrom: '#f0f0f0',
    gradientTo: '#dcdcdc',
    accentHex: '#666666',
    beforeFrom: '#dbeeff',
    beforeTo: '#b3d4f5',
    cancelPolicy: 'Отмена в любое время',
    review: { text: 'Сняла без боли и без потери своих ресниц. Очень аккуратно!', author: 'Ольга Н.' },
  },
  {
    id: 7,
    category: 'care',
    name: 'Коррекция',
    shortDesc: 'Обновление через 3–4 недели',
    description:
      'Коррекция выполняется через 3–4 недели после наращивания. ' +
      'Снимаются отросшие ресницы, добавляются новые на освободившиеся волоски. ' +
      'Результат как после полного наращивания. ' +
      'Обязательно иметь минимум 40% ресниц от предыдущего раза.',
    duration: 90,
    price: 1800,
    deposit: 400,
    durationLabel: '1,5 часа',
    emoji: '💎',
    gradientFrom: '#d6f5f0',
    gradientTo: '#a8e8dc',
    accentHex: '#00897b',
    beforeFrom: '#fff3d6',
    beforeTo: '#ffd980',
    cancelPolicy: 'Бесплатная отмена за 24 часа до визита',
    review: { text: 'Коррекция занимает меньше времени, а ресницы снова как новые!', author: 'Вика С.' },
  },
];

// ─── Слоты ────────────────────────────────────────────────────────────────────
// Базовые временные слоты рабочего дня
const BASE_SLOTS = ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'];

/**
 * Возвращает доступные слоты на дату.
 * Использует псевдослучайную функцию от числа дня для реалистичной загрузки.
 * @param {Date} date
 * @returns {string[]}
 */
function getAvailableSlots(date) {
  if (date.getDay() === 0) return []; // воскресенье — выходной
  const d = date.getDate();
  const m = date.getMonth();
  return BASE_SLOTS.filter((_, i) => {
    const hash = (d * 7 + m * 13 + i * 17 + 3) % 10;
    return hash > 3; // ~60 % слотов свободны
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
