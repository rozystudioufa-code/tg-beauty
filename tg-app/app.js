// ─── app.js ─────────────────────────────────────────────────────────────────
// Главный файл приложения: инициализация Telegram SDK, навигация,
// рендер всех 7 экранов, обработчики событий.
// ────────────────────────────────────────────────────────────────────────────

// ─── Глобальное состояние ────────────────────────────────────────────────────
const state = {
  stack:   ['home'],   // стек экранов навигации
  tab:     'home',     // активная вкладка
  booking: {           // данные текущей записи (сбрасывается при новой)
    service:  null,    // объект услуги
    date:     null,    // выбранная дата (Date)
    slot:     null,    // выбранное время (string "HH:MM")
    comment:  '',
  },
};

// ─── Ссылка на Telegram WebApp ───────────────────────────────────────────────
const tg = window.Telegram?.WebApp;

// ═══════════════════════════════════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════════════════
function initApp() {
  if (tg) {
    tg.ready();
    tg.expand();
    applyTelegramTheme();
    setupBackButton();
    setupMainButton();
    setupThemeChangeListener();
  } else {
    // Браузерный режим (разработка): тёмная тема по медиазапросу
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  renderScreen('home');
  renderScreen('catalog');
  renderScreen('bookings');
  activateTab('home');
}

// ─── Применение темы Telegram ────────────────────────────────────────────────
function applyTelegramTheme() {
  if (!tg) return;
  const p = tg.themeParams || {};
  const root = document.documentElement;

  // Тёмная / светлая тема
  const isDark = tg.colorScheme === 'dark';
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');

  // Переопределяем переменные цветами из Telegram, если они есть
  if (p.bg_color)          root.style.setProperty('--bg',       p.bg_color);
  if (p.secondary_bg_color)root.style.setProperty('--card-bg',  p.secondary_bg_color);
  if (p.text_color)        root.style.setProperty('--text',     p.text_color);
  if (p.hint_color)        root.style.setProperty('--text-sub', p.hint_color);
  if (p.link_color)        root.style.setProperty('--accent',   p.link_color);
  if (p.button_color)      root.style.setProperty('--accent',   p.button_color);
}

function setupThemeChangeListener() {
  if (!tg) return;
  tg.onEvent('themeChanged', applyTelegramTheme);
}

// ─── Кнопка Back ─────────────────────────────────────────────────────────────
function setupBackButton() {
  if (!tg?.BackButton) return;
  tg.BackButton.onClick(() => goBack());
}

function updateBackButton() {
  if (!tg?.BackButton) return;
  state.stack.length > 1 ? tg.BackButton.show() : tg.BackButton.hide();
}

// ─── MainButton ───────────────────────────────────────────────────────────────
let mainBtnHandler = null;

function setupMainButton() {
  if (!tg?.MainButton) return;
  tg.MainButton.setParams({ color: '#2aabee', text_color: '#ffffff' });
}

function showMainButton(text, handler) {
  if (!tg?.MainButton) {
    // В браузере рендерим fallback-кнопку
    renderFallbackMainButton(text, handler);
    return;
  }
  if (mainBtnHandler) tg.MainButton.offClick(mainBtnHandler);
  mainBtnHandler = handler;
  tg.MainButton.setText(text);
  tg.MainButton.onClick(mainBtnHandler);
  tg.MainButton.enable();
  tg.MainButton.show();
}

function hideMainButton() {
  if (!tg?.MainButton) {
    removeFallbackMainButton();
    return;
  }
  if (mainBtnHandler) {
    tg.MainButton.offClick(mainBtnHandler);
    mainBtnHandler = null;
  }
  tg.MainButton.hide();
}

function disableMainButton() {
  if (!tg?.MainButton) return;
  tg.MainButton.disable();
  tg.MainButton.showProgress(false);
}

function enableMainButton(text) {
  if (!tg?.MainButton) return;
  if (text) tg.MainButton.setText(text);
  tg.MainButton.enable();
  tg.MainButton.hideProgress();
}

// Fallback-кнопка для браузерного режима
function renderFallbackMainButton(text, handler) {
  removeFallbackMainButton();
  const btn = document.createElement('button');
  btn.id = 'fallback-main-btn';
  btn.textContent = text;
  btn.style.cssText = `
    position:fixed; bottom:calc(60px + env(safe-area-inset-bottom,0px));
    left:0; right:0; height:50px; background:#2aabee; color:#fff;
    font-size:16px; font-weight:600; border:none; cursor:pointer;
    z-index:999; transition:opacity .15s;
  `;
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', () => { btn.style.opacity='0.8'; });
  btn.addEventListener('touchend',   () => { btn.style.opacity='1'; });
  document.getElementById('app').appendChild(btn);
}

function removeFallbackMainButton() {
  document.getElementById('fallback-main-btn')?.remove();
}

// ═══════════════════════════════════════════════════════════════════════════
// НАВИГАЦИЯ
// ═══════════════════════════════════════════════════════════════════════════

// Перейти вперёд по стеку (анимация slide)
function navigateTo(screenId, extraState = {}) {
  Object.assign(state.booking, extraState);

  const currentId = state.stack[state.stack.length - 1];
  const currentEl = document.getElementById('screen-' + currentId);
  const newEl     = document.getElementById('screen-' + screenId);

  renderScreen(screenId);

  // Убираем активность у текущего
  currentEl.classList.add('pushed-back');

  // Принудительный reflow для корректной анимации
  void newEl.offsetWidth;
  newEl.classList.add('active');

  setTimeout(() => {
    currentEl.classList.remove('active', 'pushed-back');
  }, 270);

  state.stack.push(screenId);
  updateBackButton();
}

// Назад по стеку
function goBack() {
  if (state.stack.length <= 1) return;

  const currentId = state.stack[state.stack.length - 1];
  const prevId    = state.stack[state.stack.length - 2];

  const currentEl = document.getElementById('screen-' + currentId);
  const prevEl    = document.getElementById('screen-' + prevId);

  // Возвращаем предыдущий экран
  prevEl.classList.add('pushed-back', 'active');
  void prevEl.offsetWidth;
  prevEl.classList.remove('pushed-back');

  // Убираем текущий
  currentEl.style.transition = 'transform 260ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease';
  currentEl.style.transform  = 'translateX(100%)';
  currentEl.style.opacity    = '0';

  setTimeout(() => {
    currentEl.classList.remove('active');
    currentEl.style.transform  = '';
    currentEl.style.opacity    = '';
    currentEl.style.transition = '';
  }, 270);

  state.stack.pop();
  updateBackButton();
  hideMainButton();

  // Если вернулись на таб — восстановить состояние таба
  const tabScreens = ['home', 'catalog', 'bookings'];
  if (tabScreens.includes(prevId)) {
    activateTab(prevId, false);
  }
}

// Переключение таба (без анимации slide)
function activateTab(tabId, withAnimation = true) {
  const tabScreens = ['home', 'catalog', 'bookings'];

  tabScreens.forEach(id => {
    const el = document.getElementById('screen-' + id);
    el.classList.remove('active');
  });

  const newEl = document.getElementById('screen-' + tabId);
  if (withAnimation) {
    newEl.style.transition = 'opacity 180ms ease';
    newEl.style.opacity    = '0';
    newEl.classList.add('active');
    void newEl.offsetWidth;
    newEl.style.opacity    = '1';
    setTimeout(() => { newEl.style.transition = ''; newEl.style.opacity = ''; }, 200);
  } else {
    newEl.classList.add('active');
  }

  // Обновить кнопки навигации
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  state.tab = tabId;
  state.stack = [tabId]; // сброс стека
  updateBackButton();
  hideMainButton();

  // Перерендер динамичных табов
  if (tabId === 'bookings') renderScreen('bookings');
}

// ═══════════════════════════════════════════════════════════════════════════
// РЕНДЕР ЭКРАНОВ
// ═══════════════════════════════════════════════════════════════════════════
function renderScreen(id, data) {
  const el = document.getElementById('screen-' + id);
  if (!el) return;
  switch (id) {
    case 'home':     renderHome(el); break;
    case 'catalog':  renderCatalog(el); break;
    case 'detail':   renderDetail(el); break;
    case 'datetime': renderDateTime(el); break;
    case 'confirm':  renderConfirm(el); break;
    case 'success':  renderSuccess(el); break;
    case 'bookings': renderBookings(el); break;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// ЭКРАН 1: ГЛАВНАЯ
// ───────────────────────────────────────────────────────────────────────────
function renderHome(el) {
  const next     = getNextAvailableSlot();
  const nextText = next ? formatDateFull(next.date) + ' · ' + next.slot : 'Нет свободных мест';
  const initials = MASTER.name.split(' ').map(w => w[0]).join('').slice(0, 2);

  el.innerHTML = `
    <div class="screen-content">

      <div class="master-card">
        <div class="master-avatar">${initials}</div>
        <div class="master-info">
          <div class="master-name">${MASTER.name}</div>
          <div class="master-title">${MASTER.tagline}</div>
          <div class="master-status${MASTER.statusActive ? ' active' : ''}">
            <span class="status-dot"></span>${MASTER.status}
          </div>
        </div>
      </div>

      <div class="next-slot-card">
        <div class="next-slot-label">Ближайшее время</div>
        <div class="next-slot-time">${nextText}</div>
        <button class="btn" onclick="activateTab('catalog')">Записаться →</button>
      </div>

      <div class="section-header">Работы</div>
      <div class="works-scroll">
        ${SERVICES.map(s => `
          <div class="work-thumb ripple"
               style="background:linear-gradient(135deg,${s.gradientFrom},${s.gradientTo})"
               onclick="openDetail(${s.id})">
            <span class="work-emoji">${s.emoji}</span>
            <div class="work-name">${s.name}</div>
          </div>
        `).join('')}
      </div>

      <div class="review-card">
        <div class="review-text">❝ ${MASTER.review.text} ❞</div>
        <div class="review-author">— ${MASTER.review.author}</div>
      </div>

    </div>
  `;
}

// ───────────────────────────────────────────────────────────────────────────
// ЭКРАН 2: КАТАЛОГ УСЛУГ
// ───────────────────────────────────────────────────────────────────────────
function renderCatalog(el, activeCat = 'all') {
  const filtered = activeCat === 'all'
    ? SERVICES
    : SERVICES.filter(s => s.category === activeCat);

  el.innerHTML = `
    <div class="page-title">Услуги</div>

    <div class="tabs-scroll">
      ${CATEGORIES.map(c => `
        <button class="tab-chip${c.id === activeCat ? ' active' : ''}"
                onclick="renderCatalog(document.getElementById('screen-catalog'), '${c.id}')">
          ${c.label}
        </button>
      `).join('')}
    </div>

    <div class="services-list">
      ${filtered.map(s => `
        <div class="service-card ripple" onclick="openDetail(${s.id})">
          <div class="service-card-thumb"
               style="background:linear-gradient(135deg,${s.gradientFrom},${s.gradientTo})">
            <span class="service-card-emoji">${s.emoji}</span>
          </div>
          <div class="service-card-body">
            <div class="service-card-name">${s.name}</div>
            <div class="service-card-desc">${s.shortDesc}</div>
            <div class="service-card-footer">
              <span class="service-price">${formatPrice(s.price)}</span>
              <span class="service-meta">${s.durationLabel}</span>
            </div>
            ${s.deposit > 0 ? `<div class="deposit-badge">Депозит ${formatPrice(s.deposit)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ───────────────────────────────────────────────────────────────────────────
// ЭКРАН 3: ДЕТАЛИ УСЛУГИ
// ───────────────────────────────────────────────────────────────────────────
function openDetail(serviceId) {
  const s = SERVICES.find(x => x.id === serviceId);
  if (!s) return;
  state.booking.service = s;
  navigateTo('detail');
}

function renderDetail(el) {
  const s = state.booking.service;
  if (!s) return;

  el.classList.add('has-main-btn');

  el.innerHTML = `
    <div class="screen-content">

      <div class="detail-before-after">
        <div class="ba-frame"
             style="background:linear-gradient(135deg,${s.beforeFrom},${s.beforeTo})">
          <span class="ba-emoji">👁</span>
          <span class="ba-label">До</span>
        </div>
        <div class="ba-frame"
             style="background:linear-gradient(135deg,${s.gradientFrom},${s.gradientTo})">
          <span class="ba-emoji">${s.emoji}</span>
          <span class="ba-label">После</span>
        </div>
      </div>

      <div class="detail-title">${s.name}</div>

      <div class="detail-meta-row">
        <div class="detail-meta-item">
          ${iconClock()}
          ${s.durationLabel}
        </div>
        <div class="detail-meta-item">
          ${iconRuble()}
          ${formatPrice(s.price)}
        </div>
      </div>

      ${s.deposit > 0
        ? `<div class="detail-deposit">Депозит при записи: ${formatPrice(s.deposit)}</div>`
        : `<div class="detail-deposit">Без депозита</div>`}

      <div class="detail-description">${s.description}</div>

      <div class="review-card">
        <div class="review-text">❝ ${s.review.text} ❞</div>
        <div class="review-author">— ${s.review.author}</div>
      </div>

    </div>
  `;

  showMainButton('Выбрать дату и время →', () => navigateTo('datetime'));
}

// ───────────────────────────────────────────────────────────────────────────
// ЭКРАН 4: ВЫБОР ДАТЫ И ВРЕМЕНИ
// ───────────────────────────────────────────────────────────────────────────
function renderDateTime(el) {
  const s = state.booking.service;
  if (!s) return;

  // Генерируем 14 дней вперёд (без сегодня)
  const today = new Date();
  const days  = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }

  // Выбранная дата — первая с доступными слотами (или первая)
  if (!state.booking.date) {
    state.booking.date = days.find(d => getAvailableSlots(d).length > 0) || days[0];
  }

  el.classList.add('has-main-btn');
  el.innerHTML = '';

  // ─── Sticky: название услуги ───
  const bar = document.createElement('div');
  bar.className = 'sticky-service-bar';
  bar.innerHTML = `
    <span class="sticky-service-name">${s.name}</span>
    <span class="sticky-service-price">${formatPrice(s.price)}</span>
  `;
  el.appendChild(bar);

  // ─── Полоса дат ───
  const strip = document.createElement('div');
  strip.className = 'dates-strip';
  strip.id = 'dates-strip';
  days.forEach(d => {
    const available = getAvailableSlots(d).length > 0;
    const isActive  = isSameDay(d, state.booking.date);
    const btn = document.createElement('button');
    btn.className = `date-btn${isActive ? ' active' : ''}${!available ? ' disabled' : ''}`;
    btn.innerHTML = `
      <span class="day-name">${DAY_NAMES_SHORT[d.getDay()]}</span>
      <span class="day-num">${d.getDate()}</span>
    `;
    btn.addEventListener('click', () => selectDate(d));
    strip.appendChild(btn);
  });
  el.appendChild(strip);

  // ─── Контейнер слотов ───
  const slotsContainer = document.createElement('div');
  slotsContainer.id = 'slots-container';
  el.appendChild(slotsContainer);
  renderSlots(slotsContainer);
}

function selectDate(date) {
  state.booking.date = date;
  state.booking.slot = null;
  updateDateStrip();
  const container = document.getElementById('slots-container');
  if (container) renderSlots(container);
  disableMainButton();
}

function updateDateStrip() {
  const strip = document.getElementById('dates-strip');
  if (!strip) return;
  strip.querySelectorAll('.date-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  // Находим нужную кнопку по номеру дня
  const d = state.booking.date;
  strip.querySelectorAll('.date-btn').forEach(btn => {
    const num = parseInt(btn.querySelector('.day-num').textContent);
    if (num === d.getDate()) btn.classList.add('active');
  });
}

function renderSlots(container) {
  const date  = state.booking.date;
  const slots = getAvailableSlots(date);
  const allSlots = BASE_SLOTS;

  container.innerHTML = `
    <div class="slots-date-heading">${formatDateFull(date)}</div>
    ${slots.length === 0
      ? '<div class="slots-empty">Нет свободных мест на этот день 😔</div>'
      : `<div class="slots-grid">
          ${allSlots.map(time => {
            const available = slots.includes(time);
            const selected  = time === state.booking.slot;
            return `
              <button class="slot-btn${selected ? ' selected' : ''}${!available ? ' taken' : ''}"
                      ${!available ? 'disabled' : ''}
                      onclick="selectSlot('${time}')">
                ${time}
              </button>
            `;
          }).join('')}
        </div>`
    }
  `;
}

function selectSlot(time) {
  state.booking.slot = time;
  // Haptic feedback
  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

  // Обновляем выделение
  document.querySelectorAll('.slot-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.textContent.trim() === time);
  });

  enableMainButton('Выбрать этот слот →');
  showMainButton('Выбрать этот слот →', () => navigateTo('confirm'));
}

// ───────────────────────────────────────────────────────────────────────────
// ЭКРАН 5: ПОДТВЕРЖДЕНИЕ ЗАПИСИ
// ───────────────────────────────────────────────────────────────────────────
function renderConfirm(el) {
  const { service: s, date, slot } = state.booking;
  if (!s || !date || !slot) return;

  el.classList.add('has-main-btn');

  // Включить ClosingConfirmation — защита при закрытии на этапе оплаты
  if (tg?.enableClosingConfirmation) tg.enableClosingConfirmation();

  const btnLabel = s.deposit > 0
    ? `Оплатить депозит ${formatPrice(s.deposit)}`
    : 'Подтвердить запись';

  el.innerHTML = `
    <div class="screen-content">

      <div style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:16px;">
        Проверьте запись
      </div>

      <div class="booking-summary-card">
        <div class="booking-summary-header">
          <div class="booking-summary-service">${s.name}</div>
          <div class="booking-summary-sub">${s.shortDesc}</div>
        </div>
        <div class="booking-summary-rows">
          <div class="summary-row">
            <span class="summary-row-label">📅 Дата</span>
            <span class="summary-row-value">${formatDateFull(date)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-row-label">🕐 Время</span>
            <span class="summary-row-value">${slot}</span>
          </div>
          <div class="summary-row">
            <span class="summary-row-label">⏱ Длительность</span>
            <span class="summary-row-value">${s.durationLabel}</span>
          </div>
          <div class="summary-row">
            <span class="summary-row-label">💰 Стоимость</span>
            <span class="summary-row-value">${formatPrice(s.price)}</span>
          </div>
        </div>
      </div>

      ${s.deposit > 0 ? `
        <div class="deposit-card">
          <div class="deposit-amount">Депозит: ${formatPrice(s.deposit)}</div>
          <div class="deposit-desc">
            Я держу это время только для вас.<br>
            Остаток ${formatPrice(s.price - s.deposit)} — оплачивается на месте.
          </div>
        </div>
      ` : ''}

      <div class="cancel-policy">🔔 ${s.cancelPolicy}</div>

      <div style="padding:0 0 8px">
        <div class="comment-label">Комментарий (необязательно)</div>
        <textarea class="comment-field"
                  placeholder="Пожелания, особенности, вопросы..."
                  oninput="state.booking.comment=this.value"
        >${state.booking.comment || ''}</textarea>
      </div>

    </div>
  `;

  showMainButton(btnLabel, handleConfirmBooking);
}

function handleConfirmBooking() {
  if (tg?.MainButton) {
    tg.MainButton.setText('Обрабатываем...');
    tg.MainButton.showProgress(false);
    tg.MainButton.disable();
  }

  // Сохраняем запись в localStorage
  const { service: s, date, slot, comment } = state.booking;
  saveBooking({
    serviceName:  s.name,
    serviceId:    s.id,
    price:        s.price,
    deposit:      s.deposit,
    duration:     s.durationLabel,
    date:         date.toISOString(),
    slot,
    comment,
    address:      MASTER.addressFull,
    status:       'upcoming',
  });

  // Симулируем небольшую задержку «обработки»
  setTimeout(() => {
    if (tg?.disableClosingConfirmation) tg.disableClosingConfirmation();
    navigateTo('success');
  }, 900);
}

// ───────────────────────────────────────────────────────────────────────────
// ЭКРАН 6: УСПЕХ
// ───────────────────────────────────────────────────────────────────────────
function renderSuccess(el) {
  const { service: s, date, slot } = state.booking;
  if (!s) return;

  el.classList.remove('has-main-btn');

  // Haptic — успех
  if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

  el.innerHTML = `
    <div class="success-screen-inner">

      <div class="success-icon">
        <svg class="success-checkmark" viewBox="0 0 44 44">
          <path d="M10 22 L19 31 L34 14" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <div class="success-title">Вы записаны!</div>
      <div class="success-subtitle">
        Детали записи сохранены.<br>Напоминание придёт за 24 часа.
      </div>

      <div class="success-card">
        <div class="success-card-row">
          <div class="success-card-icon">💅</div>
          <div class="success-card-text">
            <div class="success-card-label">Услуга</div>
            <div class="success-card-value">${s.name}</div>
          </div>
        </div>
        <div class="success-card-row">
          <div class="success-card-icon">📅</div>
          <div class="success-card-text">
            <div class="success-card-label">Дата и время</div>
            <div class="success-card-value">${formatDateFull(date)}, ${slot}</div>
          </div>
        </div>
        <div class="success-card-row">
          <div class="success-card-icon">📍</div>
          <div class="success-card-text">
            <div class="success-card-label">Адрес</div>
            <div class="success-card-value">${MASTER.addressFull}</div>
          </div>
        </div>
        ${s.deposit > 0 ? `
        <div class="success-card-row">
          <div class="success-card-icon">💳</div>
          <div class="success-card-text">
            <div class="success-card-label">Депозит</div>
            <div class="success-card-value">${formatPrice(s.deposit)} ✓</div>
          </div>
        </div>` : ''}
      </div>

      <div class="success-reminder">
        🔔 Напоминание придёт за 24 часа и за 2 часа до визита
      </div>

      <button class="btn btn-secondary" style="margin-bottom:12px"
              onclick="shareBooking()">
        Поделиться записью
      </button>

    </div>
  `;

  showMainButton('На главную', () => {
    // Сброс состояния записи
    state.booking = { service: null, date: null, slot: null, comment: '' };
    hideMainButton();
    activateTab('home');
    // Перерисовать главную с обновлёнными данными
    renderScreen('home');
  });
}

function shareBooking() {
  const { service: s, date, slot } = state.booking;
  if (!s) return;
  const text = `Только что записалась на «${s.name}» к ${MASTER.name}!\n📅 ${formatDateFull(date)}, ${slot}\nЗаписывайтесь: `;
  if (tg?.switchInlineQuery) {
    // Нативный шеринг Telegram
    tg.switchInlineQuery(text);
  } else if (navigator.share) {
    navigator.share({ text });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// ЭКРАН 7: МОИ ЗАПИСИ
// ───────────────────────────────────────────────────────────────────────────
function renderBookings(el) {
  const all      = loadBookings();
  const now      = new Date();
  const upcoming = all.filter(b => new Date(b.date) > now);
  const past     = all.filter(b => new Date(b.date) <= now);

  el.innerHTML = `
    <div class="page-title">Мои записи</div>
    <div class="screen-content" style="padding-top:12px">

      ${upcoming.length === 0 && past.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-emoji">🌸</div>
          <div class="empty-state-title">Нет записей</div>
          <div class="empty-state-desc">
            Здесь появятся ваши предстоящие и прошлые визиты
          </div>
          <button class="btn btn-primary" style="max-width:240px"
                  onclick="activateTab('catalog')">
            Записаться
          </button>
        </div>
      ` : ''}

      ${upcoming.length > 0 ? `
        <div class="bookings-section-title">Предстоящие</div>
        ${upcoming.map(b => bookingItemHTML(b, true)).join('')}
      ` : ''}

      ${past.length > 0 ? `
        <div class="bookings-section-title">История</div>
        ${past.map(b => bookingItemHTML(b, false)).join('')}
      ` : ''}

    </div>
  `;
}

function bookingItemHTML(b, isUpcoming) {
  const dateStr = formatDateFull(new Date(b.date));
  return `
    <div class="booking-item">
      <div class="booking-item-header">
        <div>
          <div class="booking-item-name">${b.serviceName}</div>
          <div class="booking-item-date">${dateStr} · ${b.slot} · ${b.duration}</div>
        </div>
        <div class="booking-item-price">${formatPrice(b.price)}</div>
      </div>
      ${isUpcoming ? `
        <button class="btn btn-danger btn-sm"
                onclick="handleCancelBooking(${b.id})">
          Отменить запись
        </button>
      ` : `
        <button class="btn btn-secondary btn-sm"
                onclick="rebookService(${b.serviceId})">
          Записаться снова
        </button>
      `}
    </div>
  `;
}

function handleCancelBooking(id) {
  if (tg?.showPopup) {
    tg.showPopup({
      title:   'Отменить запись?',
      message: 'Запись будет удалена. Депозит возвращается при отмене за 24+ часа.',
      buttons: [
        { id: 'cancel', type: 'destructive', text: 'Отменить запись' },
        { id: 'keep',   type: 'default',     text: 'Оставить' },
      ],
    }, (btnId) => {
      if (btnId === 'cancel') {
        cancelBooking(id);
        renderScreen('bookings');
        const el = document.getElementById('screen-bookings');
        renderBookings(el);
      }
    });
  } else {
    if (confirm('Отменить запись?')) {
      cancelBooking(id);
      const el = document.getElementById('screen-bookings');
      renderBookings(el);
    }
  }
}

function rebookService(serviceId) {
  const s = SERVICES.find(x => x.id === serviceId);
  if (!s) return;
  state.booking.service = s;
  state.booking.date    = null;
  state.booking.slot    = null;
  navigateTo('datetime');
  activateTab('catalog'); // переключаем таб, чтобы при возврате — каталог
  // Сразу открываем datetime поверх
  setTimeout(() => navigateTo('datetime'), 50);
}

// ═══════════════════════════════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════════════════════════
const DAY_NAMES_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_NAMES_FULL  = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTH_NAMES     = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatDateFull(d) {
  return `${DAY_NAMES_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function formatPrice(n) {
  return n.toLocaleString('ru-RU') + ' ₽';
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

// SVG-иконки (inline, чтобы не тащить шрифты/библиотеки)
function iconClock() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>`;
}

function iconRuble() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M6 4h8a4 4 0 0 1 0 8H6"/><line x1="6" y1="12" x2="14" y2="12"/>
    <line x1="6" y1="16" x2="14" y2="16"/><line x1="6" y1="20" x2="6" y2="4"/>
  </svg>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ЗАПУСК
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', initApp);
