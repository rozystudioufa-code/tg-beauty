# CLAUDE.md — документация проекта tg-app

## Структура файлов

```
tg-app/
├── index.html   — точка входа; HTML-скелет всех 7 экранов + нижняя навигация
├── styles.css   — вся стилизация; CSS-переменные темы; анимации переходов
├── data.js      — данные мастера, услуг, генерация слотов, localStorage
├── app.js       — навигация, рендер экранов, Telegram SDK, обработчики
└── CLAUDE.md    — эта документация
```

---

## Навигация между экранами

Приложение использует **стек навигации** (`state.stack`).

| Функция | Что делает |
|---|---|
| `activateTab('home' / 'catalog' / 'bookings')` | Переключить таб (сброс стека, fade-анимация) |
| `navigateTo('detail' / 'datetime' / 'confirm' / 'success')` | Перейти вперёд (slide-анимация, push в стек) |
| `goBack()` | Назад (pop из стека, slide-back) |

**Флоу записи:**
```
activateTab('catalog')
  → openDetail(serviceId)    → navigateTo('detail')
  → [MainButton]             → navigateTo('datetime')
  → selectSlot()             → navigateTo('confirm')
  → handleConfirmBooking()   → navigateTo('success')
  → [MainButton "На главную"] → activateTab('home')
```

Telegram BackButton автоматически вызывает `goBack()`.

---

## Где менять данные

### Имя и данные мастера
Файл: **`data.js`**, объект `MASTER` (строки 7–17):
```js
const MASTER = {
  name:        'Разиля Сунгатова',   // ← имя мастера
  tagline:     'Мастер по наращиванию ресниц',
  address:     'Уфа, ул. Революционная, 37',
  addressFull: 'г. Уфа, ул. Революционная, д. 37, кв. 12',
  ...
};
```

### Услуги
Файл: **`data.js`**, массив `SERVICES`.
Каждый объект:
```js
{
  id:           уникальный номер,
  category:     'classic' | 'volume' | 'color' | 'care',
  name:         'Название услуги',
  shortDesc:    'Короткое описание для карточки',
  description:  'Полное описание для экрана деталей',
  duration:     длительность в минутах,
  price:        цена в рублях,
  deposit:      депозит в рублях (0 = без депозита),
  durationLabel:'1,5 часа',           // текстовая подпись
  emoji:        '✨',                  // эмодзи — визуал карточки
  gradientFrom: '#dbeeff',            // цвет карточки "после"
  gradientTo:   '#b3d4f5',
  beforeFrom:   '#f5efe6',            // цвет карточки "до"
  beforeTo:     '#e5d5c5',
  cancelPolicy: 'Текст условий отмены',
  review:       { text, author },
}
```

### Рабочие часы (временные слоты)
Файл: **`data.js`**, массив `BASE_SLOTS`:
```js
const BASE_SLOTS = ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'];
```
Добавь или убери время — слоты применятся ко всем дням.

Логика доступности: функция `getAvailableSlots(date)`.
Сейчас псевдослучайная (~60% слотов свободны).
Заменить на реальный API: вернуть `fetch('/api/slots?date=...')` из этой функции.

---

## Как добавить реальные фото

Сейчас вместо фото — CSS-градиенты с эмодзи.
Чтобы заменить на настоящие фото «до/после»:

В **`app.js`**, функция `renderDetail()`, блок `.detail-before-after`:
```html
<!-- Заменить <div class="ba-frame" style="background:..."> на: -->
<div class="ba-frame">
  <img src="images/before-classic.jpg" style="width:100%;height:100%;object-fit:cover"/>
</div>
```
Добавь поле `beforeImg` и `afterImg` в объект услуги в `data.js`.

---

## Как подключить реальную оплату (Telegram Pay)

В **`app.js`**, функция `handleConfirmBooking()`:
```js
// Вместо setTimeout — вызов оплаты:
tg.openInvoice(invoiceLink, (status) => {
  if (status === 'paid') {
    saveBooking(...);
    navigateTo('success');
  }
});
```
`invoiceLink` генерируется вашим ботом через метод `createInvoiceLink`.

---

## Как подключить бэкенд

Сейчас записи хранятся в `localStorage`. Для реального бота:

1. При записи вызвать `POST /api/bookings` с данными из `state.booking`
2. Бот получает данные через `sendData()` или webhook
3. Бот отправляет сообщение клиенту с подтверждением (`sendMessage`)
4. Напоминания — через `sendMessage` по расписанию (cron)

---

## Браузерный режим (разработка)

Открой `tg-app/index.html` напрямую в браузере — приложение запустится
без Telegram SDK (Haptic/MainButton/BackButton симулируются fallback-кодом).
MainButton рендерится как фиксированная кнопка внизу экрана.
Ширину вкладки браузера сузь до 390px для имитации телефона.
