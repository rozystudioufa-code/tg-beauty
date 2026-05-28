# Логирование — быстрая диагностика ошибок

## Как смотреть логи на сервере

```bash
ssh root@82.202.128.197

# Последние 50 строк
pm2 logs beauty-backend --lines 50 --nostream

# Следить в реальном времени
pm2 logs beauty-backend

# Только ошибки
pm2 logs beauty-backend --err --lines 100 --nostream

# Найти конкретную проблему (grep по тегу)
pm2 logs beauty-backend --lines 200 --nostream | grep "\[AUTH\]"
pm2 logs beauty-backend --lines 200 --nostream | grep "\[ERROR\]"
pm2 logs beauty-backend --lines 200 --nostream | grep "\[BOOKING\]"
```

Логи также пишутся в файлы:
```bash
tail -100 /var/log/beauty-backend.log         # все логи
tail -100 /var/log/beauty-backend.error.log   # только ошибки
```

---

## Теги в логах и что они означают

| Тег | Что логируется |
|-----|---------------|
| `[SERVER]` | Старт, краш, необработанные ошибки |
| `[AUTH]` | Входы пользователей, отказы авторизации |
| `[BOOKING]` | Создание/отмена записей, занятые слоты |
| `[DB]` | Ошибки запросов к Supabase |
| `[WEBHOOK]` | Команды от ботов (/start, /mybookings) |
| `[MASTER]` | Регистрация мастеров |
| `[SERVICE]` | Создание/изменение услуг |
| `[PERF]` | Медленные запросы (> 3 секунд) |

---

## Частые ошибки и как их чинить

### ❌ Сервер не запускается

```
[ERROR] [SERVER] Критическая ошибка — сервер упал
```

**Что делать:**
```bash
pm2 logs beauty-backend --lines 30 --nostream   # смотрим детали
```

Частые причины:
- `.env` файл не найден → `cat /root/tg-beauty/.env` (проверь что есть)
- Порт 3000 занят → `lsof -ti:3000 | xargs kill -9` и перезапустить
- Ошибка синтаксиса → проверить что `dist/` актуальна: `npm run build`

---

### ❌ Авторизация не работает

```
[WARN] [AUTH] Отказ авторизации: Неверная подпись Telegram
```

**Что делать:**
- Убедись что `BOT_TOKEN` в `.env` совпадает с токеном в @BotFather
- Mini App должна открываться через Telegram, не через браузер
- Проверь BOT_TOKEN: `cat /root/tg-beauty/.env | grep BOT_TOKEN`

---

### ❌ Запись не создаётся

```
[ERROR] [BOOKING] Ошибка создания записи
```

**Что делать:**
```bash
# Проверяем подключение к Supabase
curl http://localhost:3000/health

# Смотрим детали ошибки
pm2 logs beauty-backend --err --lines 20 --nostream
```

Частые причины:
- Функция `book_slot` не создана → запусти миграцию заново:
  ```bash
  cd /root/tg-beauty/backend && npx ts-node scripts/migrate.ts
  ```
- Неверный `SUPABASE_SERVICE_KEY` → перепроверь в Supabase → Settings → API

---

### ❌ Слот занят (это нормально, не баг)

```
[WARN] [BOOKING] Слот занят master=... 2026-06-01 10:00
```

Клиент пытается записаться на уже занятое время. Приложение покажет ему сообщение «Слот занят». Ничего чинить не нужно.

---

### ❌ Webhook бота не работает

```
[ERROR] [WEBHOOK] Не удалось установить webhook
```

**Что делать:**
- Убедись что `SERVER_URL` в `.env` — это HTTPS адрес:
  ```bash
  cat /root/tg-beauty/.env | grep SERVER_URL
  # Должно быть: SERVER_URL=https://beautybook24.ru
  ```
- Проверь что nginx и сертификат настроены:
  ```bash
  curl https://beautybook24.ru/health
  ```
- Переустанови webhook вручную (после регистрации мастера):
  ```bash
  curl -X POST "https://api.telegram.org/botТВОЙ_ТОКЕН/setWebhook" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://beautybook24.ru/v1/webhook/bot/MASTER_ID"}'
  ```

---

### ❌ Медленные запросы

```
[WARN] [PERF] Медленный запрос GET /v1/masters/... — 4200ms
```

**Что делать:**
- Проверь Supabase Dashboard → Database → Slow queries
- Обычно причина в отсутствии индексов или дорогом запросе

---

## Команды для быстрой диагностики

```bash
# Статус сервера
pm2 status

# Перезапустить после изменений
cd /root/tg-beauty && git pull && cd backend && npm install && npm run build && pm2 restart beauty-backend

# Проверить что сервер отвечает
curl http://localhost:3000/health
curl https://beautybook24.ru/health   # после настройки HTTPS

# Проверить .env
cat /root/tg-beauty/.env

# Проверить что код актуальный
cd /root/tg-beauty && git log --oneline -5
```

---

## Алгоритм диагностики при проблемах

```
1. pm2 status
   → status = stopped?  → pm2 start ecosystem.config.js
   → status = errored?  → pm2 logs --err --lines 30

2. curl http://localhost:3000/health
   → не отвечает?  → смотри логи выше

3. pm2 logs beauty-backend --lines 50 --nostream | grep [ERROR]
   → читай тег → ищи в таблице выше

4. Изменил код?
   → git pull && npm run build && pm2 restart beauty-backend
```
