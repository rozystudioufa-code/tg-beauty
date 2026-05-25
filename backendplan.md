# backendplan.md — Backend-архитектура SaaS-платформы для бьюти-мастеров

> Версия: 1.0 — май 2026  
> Автор: Разиля Сунгатова  
> Стратегические решения: централизованный сервер, каждый мастер — свой бот, управление через Mini App, оплата подпиской через Telegram Stars.

---

## Что строим

SaaS-платформа: один бэкенд обслуживает N мастеров. У каждого мастера — свой Telegram-бот (токен хранится на платформе), своя изолированная витрина, свои клиенты. Клиент видит только одного мастера. Мастер управляет всем из того же Mini App в режиме «мастер». Платформа монетизируется подпиской через Telegram Stars.

---

## Стек

| Слой | Технология | Почему |
|------|------------|--------|
| Backend | Node.js + TypeScript + Fastify | Быстрый старт, типизация, JSON-нативен |
| БД | PostgreSQL + Prisma ORM | Реляционные данные, типизированные запросы |
| Очереди | BullMQ + Redis | Напоминания за 24ч/2ч, отложенные задачи |
| Bot API | Grammy (TypeScript-first) | Мультибот-поддержка из коробки |
| Хранилище фото | Cloudflare R2 / S3 | Дешевле S3, CDN по умолчанию |
| Деплой | Railway.app | Postgres + Redis + сервер в одном месте, без Docker |
| Frontend | Без изменений (GitHub Pages) | Уже работает, добавим API-вызовы |

---

## Роли и доступ

| Роль | Кто это | Что может |
|------|---------|-----------|
| `client` | Любой Telegram-пользователь | Просматривать услуги, создавать/отменять свои записи |
| `master` | Зарегистрированный мастер | Всё что client + управлять своим профилем, услугами, расписанием, смотреть все записи к себе |
| `platform_admin` | Разиля (telegram_id захардкожен в .env) | Видеть всех мастеров, управлять подписками вручную |

Роль определяется по `telegram_id` из JWT. Если `telegram_id` совпадает с `master.telegram_id` → пользователь в режиме мастера.

---

## База данных — схема таблиц

### `masters`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
telegram_id      BIGINT UNIQUE NOT NULL        -- из tg.initDataUnsafe.user.id
username         TEXT                          -- @username в Telegram
name             TEXT NOT NULL
tagline          TEXT                          -- подзаголовок под именем
address          TEXT                          -- короткий адрес
address_full     TEXT                          -- полный адрес
experience       TEXT                          -- "5 лет"
photo_url        TEXT                          -- ссылка на R2/S3
status_text      TEXT DEFAULT 'Принимаю клиентов'
status_active    BOOLEAN DEFAULT true
telegram_handle  TEXT                          -- @username для "Согласовать время"
bot_token        TEXT UNIQUE                   -- токен бота мастера (зашифрован)
bot_username     TEXT                          -- @имя_бота (кэш после валидации)
webhook_set      BOOLEAN DEFAULT false
subscription_tier TEXT DEFAULT 'free'          -- 'free' | 'pro'
subscription_expires_at TIMESTAMPTZ
downgrade_warning_sent_at TIMESTAMPTZ         -- когда последний раз слали предупреждение об истечении
theme_accent     TEXT DEFAULT '#2aabee'        -- разблокируется в pro
theme_bg         TEXT DEFAULT '#f2f2f7'
created_at       TIMESTAMPTZ DEFAULT now()
```

### `services`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
master_id        UUID REFERENCES masters(id) ON DELETE CASCADE
category         TEXT NOT NULL               -- 'classic'|'volume'|'care'|'color'
name             TEXT NOT NULL
short_desc       TEXT
description      TEXT
price            INTEGER NOT NULL            -- в рублях
duration_minutes INTEGER NOT NULL
duration_label   TEXT                        -- "2 часа"
emoji            TEXT DEFAULT '✨'
gradient_from    TEXT DEFAULT '#dbeeff'
gradient_to      TEXT DEFAULT '#b3d4f5'
accent_hex       TEXT DEFAULT '#2a7fc2'
before_img_url   TEXT
after_img_url    TEXT
cancel_policy    TEXT DEFAULT 'Бесплатная отмена за 24 часа'
review_text      TEXT
review_author    TEXT
is_active        BOOLEAN DEFAULT true
sort_order       INTEGER DEFAULT 0
created_at       TIMESTAMPTZ DEFAULT now()
```

**Лимит:** при `subscription_tier = 'free'` запрещено создавать более 5 активных услуг (проверяется на уровне API).

### `schedule`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
master_id        UUID REFERENCES masters(id) ON DELETE CASCADE UNIQUE
weekday_slots    TEXT[] DEFAULT ARRAY['09:00','12:00']  -- пн–пт
weekend_slots    TEXT[] DEFAULT ARRAY['12:00']          -- сб–вс
```

### `bookings`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
idempotency_key  UUID UNIQUE NOT NULL        -- клиент генерирует, предотвращает дубли
master_id        UUID REFERENCES masters(id)
client_telegram_id BIGINT NOT NULL
client_name      TEXT
client_username  TEXT
service_id       UUID REFERENCES services(id)

-- Снимок данных на момент записи (услуга может измениться)
service_name     TEXT NOT NULL
price            INTEGER NOT NULL
duration_minutes INTEGER NOT NULL
duration_label   TEXT

booked_date      DATE NOT NULL
booked_slot      TIME NOT NULL
comment          TEXT DEFAULT ''
address          TEXT

status           TEXT DEFAULT 'upcoming'    -- 'upcoming'|'completed'|'cancelled'
cancelled_at     TIMESTAMPTZ
cancel_reason    TEXT

reminder_24h_sent BOOLEAN DEFAULT false
reminder_2h_sent  BOOLEAN DEFAULT false

created_at       TIMESTAMPTZ DEFAULT now()
```

### `photos`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
master_id        UUID REFERENCES masters(id) ON DELETE CASCADE
service_id       UUID REFERENCES services(id) ON DELETE SET NULL
type             TEXT NOT NULL              -- 'before'|'after'|'portfolio'|'avatar'
url              TEXT NOT NULL
sort_order       INTEGER DEFAULT 0
created_at       TIMESTAMPTZ DEFAULT now()
```

### `subscriptions`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
master_id        UUID REFERENCES masters(id)
tier             TEXT NOT NULL              -- 'pro'
started_at       TIMESTAMPTZ DEFAULT now()
expires_at       TIMESTAMPTZ NOT NULL
payment_ref      TEXT                       -- ID платежа Telegram Stars
amount_stars     INTEGER
created_at       TIMESTAMPTZ DEFAULT now()
```

---

## API — все эндпоинты

Базовый URL: `https://api.yourdomain.com/v1`

### Аутентификация

Все запросы (кроме `/auth/validate`) требуют заголовок:
```
Authorization: Bearer <JWT>
```

JWT содержит: `{ telegram_id, name, is_master, master_id?, exp }`

**Схема токенов:**
- **Access token** — живёт **1 час** (`JWT_ACCESS_EXPIRES_IN=1h`). Передаётся в каждом запросе.
- **Refresh token** — живёт **30 дней**, хранится в Redis: ключ `refresh:{token_hash}` → значение `{telegram_id, master_id}` с TTL 30d. Клиент хранит его в `localStorage` Mini App.

#### `POST /auth/validate`
Вход через Telegram Mini App. Принимает `initData` строку, валидирует HMAC с токеном **платформенного** бота (отдельный бот-регистратор), возвращает оба токена.

```json
// Request
{ "init_data": "user=%7B%22id%22%3A123...&hash=abc..." }

// Response
{
  "access_token": "eyJhbGc...",
  "refresh_token": "opaque-random-64-hex-chars",
  "is_master": false,
  "master_id": null
}
```

> Валидация HMAC обязательна на сервере. `initDataUnsafe` на клиенте не доверяем.

#### `POST /auth/refresh`
Обновление access_token без повторного открытия Mini App. Используется, когда сервер вернул `401 Unauthorized`.

```json
// Request
{ "refresh_token": "opaque-random-64-hex-chars" }

// Response
{
  "access_token": "eyJhbGc...",
  "refresh_token": "opaque-random-64-hex-chars"  // новый (rotation)
}
```

Логика: сервер находит `refresh:{sha256(token)}` в Redis → извлекает `telegram_id` → выдаёт новый access_token и **ротирует** refresh_token (старый удаляет, записывает новый). Если ключа нет в Redis → `401`, клиент перелогинивается через `initData`.

#### `POST /auth/logout`
Явный выход: удаляет `refresh:{token_hash}` из Redis. После этого дождавшийся истечения access_token больше не сможет обновиться.

```json
// Request
{ "refresh_token": "opaque-random-64-hex-chars" }
// Response: 200 OK
```

> **Правило реализации:** при удалении мастера или бане — вызывать `DEL refresh:*` по паттерну `telegram_id` из Redis (сканировать хэш-сет `user_refresh_tokens:{telegram_id}`, который ведём параллельно).

---

### Регистрация мастера

#### `POST /master/register`
Первичная регистрация: мастер вводит токен своего бота.

```json
// Request
{ "bot_token": "123456:AAF..." }

// Response — платформа проверяет токен через getMe, регистрирует webhook
{
  "master_id": "uuid",
  "bot_username": "lashmaster_ufa_bot",
  "webhook_set": true
}
```

Платформа автоматически:
1. Вызывает `telegram.getMe()` — проверяет валидность токена
2. Регистрирует webhook: `setWebhook(url: "https://api.yourdomain.com/webhook/bot/{master_id}")`
3. Устанавливает описание и команды бота через токен мастера

#### `PUT /master/bot-token`
Обновление токена (если мастер перегенерировал у BotFather). Переустанавливает webhook.

---

### Профиль мастера

#### `GET /masters/:masterId`
Публичный профиль мастера. Используется клиентским Mini App при старте.

```json
{
  "id": "uuid",
  "name": "Разиля Сунгатова",
  "tagline": "Мастер по наращиванию ресниц",
  "address": "Уфа, ул. Жукова, 10",
  "address_full": "г. Уфа, ул. Жукова, д. 10, бутик 2172",
  "photo_url": "https://r2.../master.png",
  "status_text": "Принимаю клиентов",
  "status_active": true,
  "telegram_handle": "razilyawb",
  "theme": { "accent": "#2aabee", "bg": "#f2f2f7" },
  "subscription_tier": "pro"
}
```

#### `PUT /master/profile` *(master only)*
Обновление имени, адреса, статуса, tagline, telegram_handle.

#### `PUT /master/theme` *(master + pro only)*
Обновление цветов темы. Если `subscription_tier = 'free'` → `403 Forbidden`.

---

### Услуги

#### `GET /masters/:masterId/services`
Список активных услуг для клиентов. Публичный.

#### `POST /master/services` *(master only)*
Создать услугу. Проверяет лимит 5 для `free`.

```json
// Request
{
  "category": "volume",
  "name": "Лёгкая дымка (2D)",
  "short_desc": "2D — едва уловимый объём",
  "description": "...",
  "price": 2200,
  "duration_minutes": 150,
  "duration_label": "2,5 часа",
  "emoji": "💜",
  "cancel_policy": "Бесплатная отмена за 24 часа до визита"
}
```

#### `PUT /master/services/:id` *(master only)*
Обновить услугу (цена, описание, фото, активность).

#### `DELETE /master/services/:id` *(master only)*
Деактивировать (не удалять — сохраняем историю в bookings).

#### `PUT /master/services/reorder` *(master only)*
```json
{ "order": ["uuid1", "uuid2", "uuid3"] }
```

---

### Расписание и слоты

#### `GET /masters/:masterId/slots?date=2026-05-22`
Доступные слоты на дату. Вычитает уже занятые (с учётом `duration_minutes`).

```json
{
  "date": "2026-05-22",
  "slots": ["09:00", "12:00"],
  "blocked": ["09:00"]  // занят
}
```

**Логика блокировки слотов — двусторонняя проверка overlap:**

Слот `X` (для услуги длительностью `D` минут) считается заблокированным, если он пересекается с **любой** существующей записью на эту дату. Перекрытие двух временных отрезков `[A, A+durA)` и `[B, B+durB)` проверяется условием:
```
A < B + durB  AND  B < A + durA
```

В SQL (PostgreSQL):
```sql
-- Запрос на занятые слоты с учётом длительности новой услуги
SELECT booked_slot
FROM bookings
WHERE master_id = $1
  AND booked_date = $2
  AND status = 'upcoming'
  AND booked_slot < ($new_slot + ($new_duration_min || ' minutes')::interval)::time
  AND (booked_slot + (duration_minutes || ' minutes')::interval)::time > $new_slot;
```

> **Важно:** `duration_minutes` — это `INTEGER`, `booked_slot` — это `TIME`. Прибавлять минуты к TIME нужно через `::interval`, иначе ошибка типов в PostgreSQL. Никогда не писать `booked_slot + duration_minutes` напрямую.

Ответ эндпоинта возвращает только стартовые слоты из расписания мастера. Для каждого слота из `weekday_slots` / `weekend_slots` проверяем, не перекроется ли он с существующими записями (с учётом запрашиваемой длительности).

#### `GET /masters/:masterId/slots/next`
Ближайший свободный слот в следующие 14 дней.

#### `PUT /master/schedule` *(master only)*
```json
{
  "weekday_slots": ["09:00", "12:00"],
  "weekend_slots": ["12:00"]
}
```

---

### Записи — клиент

#### `POST /masters/:masterId/bookings`
Создать запись. Idempotency key в заголовке:
```
Idempotency-Key: <UUID генерирует клиент>
```

```json
// Request
{
  "service_id": "uuid",
  "date": "2026-05-22",
  "slot": "09:00",
  "comment": "Аллергия на клей N"
}

// Response 201
{
  "booking_id": "uuid",
  "status": "upcoming",
  "service_name": "Лёгкая дымка (2D)",
  "date": "2026-05-22",
  "slot": "09:00",
  "address": "г. Уфа, ул. Жукова, д. 10, бутик 2172"
}

// Response 409 — слот занят (кто-то успел раньше)
{ "error": "slot_taken", "message": "Этот слот уже занят, выберите другое время" }
```

**Критически важно — атомарная проверка и создание в одной транзакции:**

```
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  -- 1. Блокируем строки конкурирующих записей на этот день
  SELECT id FROM bookings
  WHERE master_id = $masterId
    AND booked_date = $date
    AND status = 'upcoming'
  FOR UPDATE;

  -- 2. Проверяем overlap (см. формулу в разделе Slots)
  IF overlap_exists THEN
    ROLLBACK;
    RETURN 409 Conflict;
  END IF;

  -- 3. Вставляем запись
  INSERT INTO bookings (...) VALUES (...);

COMMIT;
```

> Без `FOR UPDATE` возможна race condition: два клиента одновременно видят слот свободным, оба проходят проверку, оба вставляют запись → двойное бронирование. `idempotency_key` защищает только от одного клиента, но не от двух разных.

После создания (вне транзакции) сервер немедленно:
1. Отправляет клиенту подтверждение через бота мастера
2. Отправляет мастеру уведомление через его бота
3. Ставит в очередь напоминания за 24ч и за 2ч

#### `GET /client/bookings`
Все записи клиента (по `client_telegram_id` из JWT).

#### `DELETE /client/bookings/:id`
Отмена. Меняет `status = 'cancelled'`, уведомляет мастера через бота.

---

### Записи — мастер

#### `GET /master/bookings?status=upcoming&date=2026-05-22` *(master only)*
Все записи к мастеру с фильтрами.

#### `PUT /master/bookings/:id/status` *(master only)*
```json
{ "status": "completed" }  // или "cancelled"
```

---

### Фотографии

#### `POST /master/photos` *(master only)*
Загрузка фото. Multipart form-data. Сервер загружает в R2, возвращает URL.

```json
// Response
{ "photo_id": "uuid", "url": "https://r2.../photo.webp" }
```

#### `DELETE /master/photos/:id` *(master only)*

#### `PUT /master/services/:id/photos` *(master only)*
Привязать фото к услуге (before/after).

---

### Подписка

#### `GET /master/subscription`
Текущий статус: тариф, дата истечения, количество услуг.

#### `POST /master/subscription/checkout`
Генерирует Telegram Stars инвойс.

```json
// Request
{ "months": 1 }

// Response  
{ "invoice_link": "https://t.me/$invoice..." }
```

Платформенный бот создаёт инвойс через `createInvoiceLink` в Stars. Мастер открывает ссылку и платит.

#### `POST /webhook/stars-payment` *(внутренний, от Telegram)*
Telegram присылает `pre_checkout_query` и `successful_payment`. После подтверждения:
1. Обновляем `subscription_tier = 'pro'`, `subscription_expires_at = now() + 30 days`
2. Пишем запись в `subscriptions`
3. Отправляем мастеру сообщение: «Подписка активирована до DD.MM.YYYY»

---

### Webhook — боты мастеров

#### `POST /webhook/bot/:masterId`
Сюда приходят все обновления от бота конкретного мастера. Платформа обрабатывает команды клиентов:

| Команда | Что делает |
|---------|------------|
| `/start` | Отправляет кнопку с ссылкой на Mini App мастера |
| `/help` | Инструкция: как записаться, как отменить, контакт мастера |
| `/mybookings` | Список предстоящих записей клиента |
| `/cancel` | Отмена последней записи (с подтверждением) |

Когда мастер пишет в своём боте `/master` — переходит в режим управления (если `telegram_id` совпадает).

---

## Очереди и фоновые задачи (BullMQ + Redis)

### `reminder-24h` queue
Запускается при создании записи. Delayed job на `booking_date - 24h`.
```
Сообщение клиенту: "Разиля ждёт вас завтра в 09:00. Адрес: ..."
Сообщение мастеру: "Напоминание: завтра в 09:00 — Юля М., Лёгкая дымка (2D)"
```

### `reminder-2h` queue
Аналогично, delayed job на `booking_date - 2h`.

### `subscription-expiry-warn` cron (ежедневно в 08:00)
Предупреждает мастеров об истечении подписки. Условия запуска:
```
expires_at IS NOT NULL
AND expires_at > now()                          -- ещё не истекла
AND expires_at <= now() + INTERVAL '3 days'    -- истекает в ближайшие 3 дня
AND (
  downgrade_warning_sent_at IS NULL
  OR downgrade_warning_sent_at < now() - INTERVAL '23 hours'  -- не слали сегодня
)
```
Действие:
1. Отправляет мастеру через бота: «Ваша подписка Pro истекает DD.MM.YYYY. Продлите, чтобы не потерять услуги X, Y, Z.»
2. Обновляет `downgrade_warning_sent_at = now()` в `masters`

### `subscription-downgrade` cron (ежедневно в 09:00, через час после warn)
Обрабатывает истёкшие подписки. Условие: `subscription_expires_at < now() AND subscription_tier = 'pro'`.

Для каждого такого мастера:
1. Получить список активных услуг, отсортированных `ORDER BY sort_order ASC` (низкий sort_order = важные, останутся)
2. Если услуг > 5:
   - Первые 5 (с наименьшим `sort_order`) остаются активными
   - Остальные: `is_active = false`
   - Собрать список деактивированных имён для уведомления
3. Установить `subscription_tier = 'free'`, `subscription_expires_at = NULL`
4. Отправить мастеру через бота:
   ```
   Ваша подписка Pro истекла. Аккаунт переведён на Free.
   Скрытые услуги: [X, Y, Z] — зайдите в настройки, чтобы выбрать 5 активных.
   Продлить подписку: [ссылка]
   ```

> **Почему два отдельных крона:** если объединить — мастер получает предупреждение и даунгрейд одновременно в день истечения, что непонятно и пугает. Разделение даёт 3 дня на реакцию.

### `post-visit-share` queue
Через 2 часа после завершённого визита (`status = 'completed'`):
Отправляет клиенту: «Рады были видеть вас! Поделитесь с подругой → [ссылка]»

---

## Безопасность

| Угроза | Защита |
|--------|--------|
| Поддельный `initData` | HMAC-валидация на сервере с токеном бота |
| Чужие записи | Все booking-запросы проверяют `client_telegram_id === JWT.telegram_id` |
| Чужие данные мастера | Все master-запросы проверяют `master.telegram_id === JWT.telegram_id` |
| Двойная запись одним клиентом | `idempotency_key UNIQUE` в БД |
| Race condition двух клиентов на один слот | `SELECT FOR UPDATE` в транзакции при создании записи → `409 Conflict` |
| Переполнение услуг | Счётчик на `POST /master/services` до инсерта |
| Открытый токен бота | Хранится зашифрованным (AES-256), расшифровывается только при webhook |
| XSS в комментариях | Все user-input через `DOMTextContent`, не `innerHTML` |
| DoS через бронирования | Rate limit: 5 `POST /bookings` в час на `client_telegram_id` |
| Спам валидации initData | Rate limit: 10 запросов в минуту на IP для `POST /auth/validate` |
| Исчерпание хранилища фото | Rate limit: 20 загрузок в час на мастера; проверка размера файла до загрузки в R2 |
| Перебор чужих bot-токенов | Rate limit: 3 `POST /master/register` в час на IP |
| Компрометация access_token | Короткий TTL (1ч) + refresh rotation в Redis |

### Rate limiting — реализация

Плагин: `@fastify/rate-limit` с Redis-store (тот же Redis что для BullMQ).

```ts
// Пример регистрации в Fastify
fastify.register(require('@fastify/rate-limit'), {
  global: false,  // не глобально — настраиваем на каждом роуте отдельно
  redis: redisClient,
});

// На роуте POST /auth/validate:
{ config: { rateLimit: { max: 10, timeWindow: '1 minute', keyGenerator: (req) => req.ip } } }

// На роуте POST /masters/:masterId/bookings:
{ config: { rateLimit: { max: 5, timeWindow: '1 hour', keyGenerator: (req) => req.user.telegram_id } } }

// На роуте POST /master/photos:
{ config: { rateLimit: { max: 20, timeWindow: '1 hour', keyGenerator: (req) => req.user.telegram_id } } }

// На роуте POST /master/register:
{ config: { rateLimit: { max: 3, timeWindow: '1 hour', keyGenerator: (req) => req.ip } } }
```

При превышении лимита возвращать `429 Too Many Requests` с заголовком `Retry-After`.

---

## Как мастер подключается с нуля (онбординг-флоу)

```
1. Мастер создаёт бота у @BotFather → получает токен
2. Открывает платформенный Mini App (например t.me/beauty_platform_bot/app)
3. Нажимает «Я мастер» → вводит токен своего бота
4. Платформа:
   - Валидирует токен через getMe()
   - Регистрирует webhook на свой сервер
   - Создаёт запись в masters
   - Настраивает команды бота (/start, /help, /mybookings)
5. Мастер заполняет профиль: имя, адрес, фото, услуги
6. Получает ссылку t.me/его_бот и t.me/его_бот/app
7. Клиенты переходят по ссылке → видят Mini App мастера
```

---

## Как Mini App узнаёт какого мастера показывать

Mini App определяет `master_id` из deep link параметра `startapp`:

```
t.me/lashmaster_ufa_bot/app?startapp=master_abc123
```

При открытии:
1. `tg.initDataUnsafe.start_param` содержит `master_abc123`
2. Или — если бот у мастера один — `master_id` берётся из бота (бот знает свой master_id)
3. Клиентский JS делает `GET /masters/:masterId` и рендерит данные этого мастера

**Рекомендуется:** каждый бот мастера на `/start` присылает кнопку с deep link `t.me/botname/app` — тогда `master_id` всегда известен из контекста бота.

---

## Что бесплатно, что платно

| Функция | Free | Pro |
|---------|------|-----|
| Количество услуг | 5 | Без ограничений |
| Управление расписанием | ✓ | ✓ |
| Уведомления клиентам | ✓ | ✓ |
| Загрузка фото | ✓ (до 20 Мб) | ✓ (до 200 Мб) |
| Тема приложения (цвета) | Стандартная | Своя (любые цвета) |
| Статистика записей | Нет | ✓ |
| Приоритетная поддержка | Нет | ✓ |
| Цена | 0 ₽ | N⭐ Stars/мес |

---

## Переменные окружения (.env на сервере)

```env
# База данных
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Платформенный бот (для валидации initData и приёма Stars-платежей)
PLATFORM_BOT_TOKEN=...
PLATFORM_BOT_SECRET=...

# Шифрование токенов мастеров
ENCRYPTION_KEY=...   # 32 байта, AES-256

# Хранилище фото
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=...

# Admin
PLATFORM_ADMIN_TELEGRAM_ID=...  # telegram_id Разили

# Подписка
PRO_PRICE_STARS=250   # цена подписки в Stars
PRO_DURATION_DAYS=30

# JWT
JWT_SECRET=...
JWT_ACCESS_EXPIRES_IN=1h          # access token — короткий
REFRESH_TOKEN_TTL_DAYS=30         # refresh token хранится в Redis с этим TTL
```

---

## Порядок разработки

1. **БД и миграции** — Prisma schema, все таблицы (включая `downgrade_warning_sent_at` в masters)
2. **Auth** — `POST /auth/validate` (HMAC + JWT access 1ч), `POST /auth/refresh` (Redis refresh rotation), `POST /auth/logout` (удаление из Redis)
3. **Rate limiting** — подключить `@fastify/rate-limit` с Redis-store; навесить лимиты на `/auth/validate`, `/bookings`, `/photos`, `/master/register` согласно таблице безопасности
4. **Master CRUD** — регистрация, профиль, токен бота, webhook
5. **Services CRUD** — с лимитом free
6. **Slots API** — `getAvailableSlots` на сервере с двусторонней overlap-формулой и корректным SQL `::interval` кастом
7. **Bookings** — создание в транзакции `SERIALIZABLE` с `SELECT FOR UPDATE` → `409` при конфликте, idempotency, отмена, список
8. **Notifications** — BullMQ очереди (reminder-24h, reminder-2h, post-visit-share), отправка через Grammy
9. **Photos** — загрузка в R2, валидация типа и размера файла до отправки в R2, привязка к услуге
10. **Subscription** — Stars инвойс, webhook, активация; два отдельных крона (`subscription-expiry-warn` в 08:00 и `subscription-downgrade` в 09:00)
11. **Master panel в Mini App** — переключение режима, формы редактирования
12. **Theme** — применение цветов из `/master/:id` в CSS-переменные
13. **Тестирование** — TESTING.md обновить под API-режим; отдельно тестировать race condition (два параллельных запроса на один слот)
