// ─── app.js ─────────────────────────────────────────────────────────────────
// Главный файл приложения: инициализация Telegram SDK, навигация,
// рендер всех 7 экранов, обработчики событий.
// ────────────────────────────────────────────────────────────────────────────

// ─── Глобальное состояние ────────────────────────────────────────────────────
const state = {
  stack:   ['home'],
  tab:     'home',
  booking: {
    service:  null,
    date:     null,
    slot:     null,
    comment:  '',
  },
  // API-данные (null = ещё не загружены или API недоступен)
  master:     null,   // данные мастера из API
  services:   null,   // услуги из API
  isMaster:   false,  // текущий пользователь — мастер
  masterApiId: null,  // master_id из JWT
};

// ─── Ссылка на Telegram WebApp ───────────────────────────────────────────────
const tg       = window.Telegram?.WebApp;
const inTelegram = !!(tg?.initData);

// ═══════════════════════════════════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════════════════
async function initApp() {
  if (tg) {
    tg.ready();
    tg.expand();
    applyTelegramTheme();
    setupBackButton();
    setupMainButton();
    setupThemeChangeListener();
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  // Авторизуемся и загружаем данные из API (если API_URL задан)
  await initApi();
  const [master, services] = await Promise.all([apiGetMaster(), apiGetServices()]);
  if (master)   state.master   = master;
  if (services) state.services = services;

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
  if (!inTelegram) return;
  tg.BackButton.onClick(() => goBack());
}

function updateBackButton() {
  if (!inTelegram) return;
  state.stack.length > 1 ? tg.BackButton.show() : tg.BackButton.hide();
}

// ─── MainButton ───────────────────────────────────────────────────────────────
let mainBtnHandler = null;

function setupMainButton() {
  if (!tg?.MainButton) return;
  tg.MainButton.setParams({ color: '#2aabee', text_color: '#ffffff' });
}

function showMainButton(text, handler) {
  if (!inTelegram) return;
  if (mainBtnHandler) tg.MainButton.offClick(mainBtnHandler);
  mainBtnHandler = handler;
  tg.MainButton.setText(text);
  tg.MainButton.onClick(mainBtnHandler);
  tg.MainButton.enable();
  tg.MainButton.show();
}

function hideMainButton() {
  if (!inTelegram) return;
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

  // Убираем все экраны — и табы и промежуточные (detail, datetime, confirm, success)
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active', 'pushed-back');
    el.style.transform = '';
    el.style.opacity   = '';
    el.style.transition = '';
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
  const initials  = MASTER.name.split(' ').map(w => w[0]).join('').slice(0, 2);
  const avatarHtml = MASTER.photo
    ? `<img src="images/${MASTER.photo}" alt="${MASTER.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
    : initials;

  el.innerHTML = `
    <div class="screen-content">

      <div class="master-card">
        <div class="master-avatar">${avatarHtml}</div>
        <div class="master-info">
          <div class="master-name">${MASTER.name}</div>
          <div class="master-title">${MASTER.tagline}</div>
          <div class="master-status${MASTER.statusActive ? ' active' : ''}">
            <span class="status-dot"></span>${MASTER.status}
          </div>
        </div>
      </div>

      <div class="master-address">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${MASTER.addressFull}
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
               onclick="openDetail('${s.id}')">
            <span class="work-emoji">${s.emoji}</span>
            <div class="work-name">${s.name}</div>
          </div>
        `).join('')}
      </div>

      <div class="review-card">
        <div class="review-text">❝ ${MASTER.review.text} ❞</div>
        <div class="review-author">— ${MASTER.review.author}</div>
      </div>

      <button class="share-btn ripple" onclick="shareApp()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Поделиться с подругой
      </button>

    </div>
  `;
}

// ───────────────────────────────────────────────────────────────────────────
// ЭКРАН 2: КАТАЛОГ УСЛУГ
// ───────────────────────────────────────────────────────────────────────────
function renderCatalog(el, activeCat = 'all') {
  const allServices = state.services || SERVICES;
  const filtered = activeCat === 'all'
    ? allServices
    : allServices.filter(s => s.category === activeCat);

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
        <div class="service-card ripple" onclick="openDetail('${s.id}')">
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
  const list = state.services || SERVICES;
  const s = list.find(x => x.id == serviceId); // == чтобы работало и с UUID и с числом
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

      <button onclick="goBack()" style="display:flex;align-items:center;gap:4px;background:none;border:none;color:var(--accent);font-size:15px;font-weight:600;padding:8px 0 4px;cursor:pointer;margin-bottom:4px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Назад
      </button>

      <div class="detail-before-after">
        <div class="ba-frame" style="${s.beforeImg ? '' : `background:linear-gradient(135deg,${s.beforeFrom},${s.beforeTo})`}">
          ${s.beforeImg
            ? `<img src="images/${s.beforeImg}" alt="до" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>`
            : `<span class="ba-emoji">👁</span>`
          }
          <span class="ba-label">До</span>
        </div>
        <div class="ba-frame" style="${s.afterImg ? '' : `background:linear-gradient(135deg,${s.gradientFrom},${s.gradientTo})`}">
          ${s.afterImg
            ? `<img src="images/${s.afterImg}" alt="после" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>`
            : `<span class="ba-emoji">${s.emoji}</span>`
          }
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

      <div class="detail-description">${s.description}</div>

      <div class="review-card">
        <div class="review-text">❝ ${s.review.text} ❞</div>
        <div class="review-author">— ${s.review.author}</div>
      </div>

      <button class="btn-book-detail" onclick="navigateTo('datetime')">
        Выбрать дату и время →
      </button>

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

  // ─── Sticky: кнопка назад + название услуги ───
  const bar = document.createElement('div');
  bar.className = 'sticky-service-bar';
  bar.innerHTML = `
    <button onclick="goBack()" class="sticky-back-btn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <span class="sticky-service-name">${s.name}</span>
    <span class="sticky-service-price">${formatPrice(s.price)}</span>
  `;
  el.appendChild(bar);

  // ─── Полоса дат ───
  const stripWrap = document.createElement('div');
  stripWrap.className = 'dates-strip-wrap';

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
      <span class="day-month">${MONTH_SHORT[d.getMonth()]}</span>
    `;
    btn.addEventListener('click', () => selectDate(d));
    strip.appendChild(btn);
  });

  stripWrap.appendChild(strip);
  el.appendChild(stripWrap);

  // ─── Контейнер слотов ───
  const slotsContainer = document.createElement('div');
  slotsContainer.id = 'slots-container';
  el.appendChild(slotsContainer);
  renderSlots(slotsContainer);

  // ─── Кнопка согласования времени ───
  const customTime = document.createElement('div');
  customTime.innerHTML = `
    <div class="custom-time-block">
      <div class="custom-time-text">Не подходит время?</div>
      <button class="custom-time-btn" onclick="openCustomTimeChat()">
        Согласовать индивидуально
      </button>
    </div>
  `;
  el.appendChild(customTime);
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

  container.innerHTML = `
    <div class="slots-date-heading">${formatDateFull(date)}</div>
    ${slots.length === 0
      ? '<div class="slots-empty">Нет свободных мест на этот день 😔</div>'
      : `<div class="slots-grid">
          ${slots.map(time => {
            const selected = time === state.booking.slot;
            return `
              <button class="slot-btn${selected ? ' selected' : ''}"
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
  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

  document.querySelectorAll('.slot-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.textContent.trim() === time);
  });

  enableMainButton('Выбрать этот слот →');
  showMainButton('Выбрать этот слот →', () => navigateTo('confirm'));

  // Показываем inline-кнопку для мобильного браузера
  let confirmBtn = document.getElementById('slot-confirm-btn');
  if (!confirmBtn) {
    confirmBtn = document.createElement('button');
    confirmBtn.id = 'slot-confirm-btn';
    confirmBtn.className = 'btn-book-detail';
    confirmBtn.style.margin = '16px 16px 8px';
    confirmBtn.style.width = 'calc(100% - 32px)';
    confirmBtn.onclick = () => navigateTo('confirm');
    document.getElementById('screen-datetime').appendChild(confirmBtn);
  }
  confirmBtn.textContent = `Записаться на ${time} →`;
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

  const btnLabel = 'Подтвердить запись';

  el.innerHTML = `
    <div class="screen-content">

      <button onclick="goBack()" style="display:flex;align-items:center;gap:4px;background:none;border:none;color:var(--accent);font-size:15px;font-weight:600;padding:8px 0 4px;cursor:pointer;margin-bottom:4px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Назад
      </button>

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


      <div class="cancel-policy">🔔 ${s.cancelPolicy}</div>

      <div style="padding:0 0 8px">
        <div class="comment-label">Комментарий (необязательно)</div>
        <textarea class="comment-field"
                  placeholder="Пожелания, особенности, вопросы..."
                  oninput="state.booking.comment=this.value"
        >${state.booking.comment || ''}</textarea>
      </div>

      <button class="btn-book-detail" onclick="handleConfirmBooking()">
        Подтвердить запись
      </button>

    </div>
  `;

  showMainButton(btnLabel, handleConfirmBooking);
}

async function handleConfirmBooking() {
  if (tg?.MainButton) {
    tg.MainButton.setText('Обрабатываем...');
    tg.MainButton.showProgress(false);
    tg.MainButton.disable();
  }

  const { service: s, date, slot, comment } = state.booking;
  const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;

  // Пробуем сохранить через API
  const apiResult = await apiCreateBooking({
    service_id: s.id,
    date:       dateStr,
    slot,
    comment:    comment || '',
  });

  if (!apiResult) {
    // Fallback: сохраняем локально (API недоступен)
    const master = state.master || MASTER;
    saveBooking({
      serviceName:     s.name,
      serviceId:       s.id,
      price:           s.price,
      deposit:         s.deposit || 0,
      duration:        s.durationLabel,
      durationMinutes: s.duration,
      date:            date instanceof Date ? date.toISOString() : date,
      slot,
      comment,
      address:         master.addressFull || master.address_full || '',
      status:          'upcoming',
    });
  }

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
      </div>

      <div class="success-reminder">
        🔔 Напоминание придёт за 24 часа и за 2 часа до визита
      </div>

      <div class="success-nav-hint">
        Используй навигацию внизу чтобы вернуться на главную или записаться снова
      </div>

    </div>
  `;

  showMainButton('На главную', goHome);
}

function goHome() {
  state.booking = { service: null, date: null, slot: null, comment: '' };
  hideMainButton();
  activateTab('home');
  renderScreen('home');
}

function bookAnother() {
  state.booking = { service: null, date: null, slot: null, comment: '' };
  hideMainButton();
  activateTab('catalog');
}

function openCustomTimeChat() {
  const service = state.booking.service;
  const url = `https://t.me/${MASTER.telegram}${service ? `?text=${encodeURIComponent(`Здравствуйте! Хочу записаться на «${service.name}», но стандартное время не подходит. Можем согласовать?`)}` : ''}`;
  if (tg?.openLink) {
    tg.openLink(url);
  } else {
    window.open(url, '_blank');
  }
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
async function renderBookings(el) {
  // Пробуем загрузить из API, fallback на localStorage
  const apiBookings = await apiGetClientBookings();
  const all         = apiBookings || loadBookings();
  const now         = new Date();
  const upcoming    = all.filter(b => new Date(b.date) > now);
  const past        = all.filter(b => new Date(b.date) <= now);

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
                data-cancel-id="${b.id}"
                onclick="handleCancelBooking(${b.id}, this)">
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

function handleCancelBooking(id, btn) {
  if (inTelegram && tg.showPopup) {
    tg.showPopup({
      title:   'Отменить запись?',
      message: 'Запись будет удалена.',
      buttons: [
        { id: 'cancel', type: 'destructive', text: 'Отменить запись' },
        { id: 'keep',   type: 'default',     text: 'Оставить' },
      ],
    }, (btnId) => {
      if (btnId === 'cancel') {
        cancelBooking(id);
        renderBookings(document.getElementById('screen-bookings'));
      }
    });
    return;
  }

  // Браузер — двойное нажатие
  if (!btn) btn = document.querySelector(`[data-cancel-id="${id}"]`);
  if (!btn) return;

  if (btn.dataset.confirm === '1') {
    cancelBooking(id);
    renderBookings(document.getElementById('screen-bookings'));
  } else {
    btn.dataset.confirm = '1';
    btn.textContent = 'Точно отменить?';
    btn.style.background = 'var(--danger, #ff3b30)';
    btn.style.color = '#fff';
    setTimeout(() => {
      if (btn && btn.dataset.confirm === '1') {
        btn.dataset.confirm = '';
        btn.textContent = 'Отменить запись';
        btn.style.background = '';
        btn.style.color = '';
      }
    }, 3000);
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
// ИКОНКИ УСЛУГ — SVG-веера ресниц
// ═══════════════════════════════════════════════════════════════════════════
function lashIcon(id) {
  // Стиль: изогнутое веко + ресницы свисают вниз, расходятся наружу
  const lid = `<path d="M8,26 Q32,4 50,3 Q68,4 92,26" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`;

  // Каждая ресница: M(x-w,y) Q(ctrl_lean) (tipX,tipY) Q(ctrl_lean2) (x+w,y) Z
  const sets = {
    1: [ // Классика — 5 ресниц, натуральные
      `<path d="M19,21 Q10,34 11,48 Q16,34 24,21 Z"/>`,
      `<path d="M32,11 Q25,27 25,44 Q30,27 37,11 Z"/>`,
      `<path d="M48,4  Q46,23 48,46 Q52,23 53,4  Z"/>`,
      `<path d="M63,11 Q67,27 73,44 Q70,27 68,11 Z"/>`,
      `<path d="M76,21 Q82,34 87,48 Q84,34 81,21 Z"/>`,
    ],
    2: [ // 2D — 7 ресниц
      `<path d="M14,24 Q6,36  7,50  Q12,36 19,24 Z"/>`,
      `<path d="M25,14 Q18,29 17,46 Q22,29 30,14 Z"/>`,
      `<path d="M38,7  Q33,24 32,44 Q37,24 43,7  Z"/>`,
      `<path d="M50,3  Q48,22 49,46 Q53,22 55,3  Z"/>`,
      `<path d="M62,7  Q65,24 70,44 Q67,24 67,7  Z"/>`,
      `<path d="M74,14 Q77,29 82,46 Q79,29 79,14 Z"/>`,
      `<path d="M84,24 Q87,36 91,50 Q89,35 89,24 Z"/>`,
    ],
    3: [ // 3D — 9 ресниц
      `<path d="M12,25 Q4,37  5,51  Q10,37 17,25 Z"/>`,
      `<path d="M21,17 Q14,31 13,48 Q18,31 26,17 Z"/>`,
      `<path d="M31,10 Q25,26 24,45 Q29,26 36,10 Z"/>`,
      `<path d="M41,5  Q37,22 36,44 Q41,22 46,5  Z"/>`,
      `<path d="M50,3  Q48,21 49,46 Q53,21 55,3  Z"/>`,
      `<path d="M59,5  Q61,22 66,44 Q63,22 64,5  Z"/>`,
      `<path d="M69,10 Q72,26 78,45 Q73,26 74,10 Z"/>`,
      `<path d="M79,17 Q82,31 87,48 Q84,31 84,17 Z"/>`,
      `<path d="M87,25 Q90,37 93,51 Q91,36 92,25 Z"/>`,
    ],
    4: [ // 4D — 11 ресниц, максимальный объём
      `<path d="M10,26 Q2,38  3,53  Q8,38  15,26 Z"/>`,
      `<path d="M18,19 Q11,33 10,51 Q15,33 23,19 Z"/>`,
      `<path d="M26,13 Q20,28 18,48 Q23,28 31,13 Z"/>`,
      `<path d="M35,7  Q30,24 28,46 Q33,24 40,7  Z"/>`,
      `<path d="M43,4  Q40,21 39,45 Q44,21 48,4  Z"/>`,
      `<path d="M50,3  Q48,21 49,47 Q53,21 55,3  Z"/>`,
      `<path d="M57,4  Q58,21 62,45 Q58,21 62,4  Z"/>`,
      `<path d="M65,7  Q67,24 73,46 Q69,24 70,7  Z"/>`,
      `<path d="M73,13 Q76,28 82,48 Q78,28 78,13 Z"/>`,
      `<path d="M81,19 Q84,33 89,51 Q86,33 86,19 Z"/>`,
      `<path d="M89,26 Q91,38 94,53 Q92,37 94,26 Z"/>`,
    ],
    5: [ // Коррекция — 7 ресниц + искра
      `<path d="M14,24 Q6,36  7,50  Q12,36 19,24 Z"/>`,
      `<path d="M25,14 Q18,29 17,46 Q22,29 30,14 Z"/>`,
      `<path d="M38,7  Q33,24 32,44 Q37,24 43,7  Z"/>`,
      `<path d="M50,3  Q48,22 49,46 Q53,22 55,3  Z"/>`,
      `<path d="M62,7  Q65,24 70,44 Q67,24 67,7  Z"/>`,
      `<path d="M74,14 Q77,29 82,46 Q79,29 79,14 Z"/>`,
      `<path d="M84,24 Q87,36 91,50 Q89,35 89,24 Z"/>`,
      `<path d="M80,52 L81.5,47 L83,52 L88,53.5 L83,55 L81.5,60 L80,55 L75,53.5 Z"/>`,
    ],
  };
  const paths = (sets[id] || sets[1]).join('');
  return `<svg viewBox="0 0 100 66" fill="currentColor" xmlns="http://www.w3.org/2000/svg">${lid}${paths}</svg>`;
}

// ═══════════════════════════════════════════════════════════════════════════
const DAY_NAMES_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_NAMES_FULL  = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTH_NAMES     = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTH_SHORT     = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

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
// ─── Онбординг + оффер + шаринг ─────────────────────────────────────────────
const ONBOARD_KEY = 'tg_beauty_onboarded';
const OFFER_KEY   = 'tg_beauty_offer_shown';

// Онбординг — показываем один раз при первом визите
function maybeShowOnboarding() {
  if (localStorage.getItem(ONBOARD_KEY)) {
    maybeShowOffer(); // уже онбордились — сразу проверяем оффер
    return;
  }
  const modal = document.getElementById('onboard-modal');
  if (!modal) return;
  // Обращение по имени из Telegram
  const firstName = tg?.initDataUnsafe?.user?.first_name;
  const nameEl = modal.querySelector('.onboard-name');
  if (nameEl) nameEl.textContent = firstName ? `Привет, ${firstName}!` : 'Привет!';
  modal.style.display = 'flex';
}

function closeOnboarding() {
  localStorage.setItem(ONBOARD_KEY, '1');
  const modal = document.getElementById('onboard-modal');
  if (!modal) return;
  modal.style.transition = 'opacity 220ms ease';
  modal.style.opacity = '0';
  setTimeout(() => {
    modal.style.display = 'none';
    setTimeout(maybeShowOffer, 1000); // оффер — через 1 сек после закрытия
  }, 220);
}

// Оффер — показываем один раз после онбординга
function maybeShowOffer() {
  if (localStorage.getItem(OFFER_KEY)) return;
  const modal = document.getElementById('offer-modal');
  if (!modal) return;
  setTimeout(() => { modal.style.display = 'flex'; }, 600);
}

function closeOffer() {
  localStorage.setItem(OFFER_KEY, '1');
  const modal = document.getElementById('offer-modal');
  if (!modal) return;
  modal.style.transition = 'opacity 200ms ease';
  modal.style.opacity = '0';
  setTimeout(() => { modal.style.display = 'none'; }, 200);
}

// Поделиться с подругой
function shareApp() {
  const url  = 'https://t.me/lashmaster_ufa_bot';
  const text = 'Записываюсь на наращивание ресниц здесь — рекомендую! 💜';
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (inTelegram) {
    tg.openTelegramLink(shareUrl);
  } else {
    window.open(shareUrl, '_blank');
  }
  if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  maybeShowOnboarding();
});
