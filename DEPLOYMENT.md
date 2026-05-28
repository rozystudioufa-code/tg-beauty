# Инструкция по деплою — tg-beauty-catalog

Этот документ описывает как запустить бэкенд на VPS-сервере с нуля.

---

## Что понадобится перед началом

| Что | Где взять |
|-----|-----------|
| VPS-сервер (Ubuntu 22/24) | Beget, Timeweb, Hetzner |
| Домен (например beautybook.ru) | У того же провайдера |
| Аккаунт Supabase с проектом | supabase.com |
| Токен Telegram-бота | @BotFather в Telegram |
| Git-репозиторий с кодом | GitHub |

---

## Шаг 1 — Подключение к серверу

Открой Терминал (Mac) или PowerShell (Windows):

```bash
ssh root@ВАШ_IP
```

Введи пароль. При первом подключении появится вопрос про fingerprint — ответь `yes`.

---

## Шаг 2 — Установка Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
```

Проверить:
```bash
node --version   # должно быть v20.x.x
```

---

## Шаг 3 — Установка PM2

PM2 держит сервер запущенным и перезапускает его при сбоях:

```bash
npm install -g pm2
```

---

## Шаг 4 — Скачивание кода

```bash
cd /root && git clone https://github.com/rozystudioufa-code/tg-beauty.git
```

---

## Шаг 5 — Файл с секретами (.env)

Создай файл `/root/tg-beauty/.env` с твоими данными:

```bash
cat > /root/tg-beauty/.env << 'EOF'
BOT_TOKEN=токен_от_BotFather
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
DATABASE_URL=postgresql://postgres.xxx:пароль@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
JWT_SECRET=случайная_строка_32_символа
SERVER_URL=https://ВАШ_ДОМЕН
EOF
```

> `JWT_SECRET` — любая случайная строка. Сгенерировать:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## Шаг 6 — Сборка и запуск

```bash
cd /root/tg-beauty/backend && npm install && npm run build
```

Запуск миграции базы данных (один раз):
```bash
npx ts-node scripts/migrate.ts
```

Запуск сервера:
```bash
pm2 start /root/tg-beauty/backend/ecosystem.config.js
```

Проверка:
```bash
curl http://localhost:3000/health
# Ответ: {"status":"ok","time":"..."}
```

Автозапуск при перезагрузке сервера:
```bash
pm2 save && pm2 startup
```

---

## Шаг 7 — Настройка HTTPS (обязательно для Telegram)

Telegram не принимает HTTP. Нужен домен и SSL-сертификат.

### 7.1 — Установка nginx и certbot

```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

### 7.2 — Конфиг nginx

```bash
cat > /etc/nginx/sites-available/beauty << 'EOF'
server {
    listen 80;
    server_name ВАШ_ДОМЕН;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

ln -s /etc/nginx/sites-available/beauty /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 7.3 — SSL-сертификат (бесплатно от Let's Encrypt)

Сначала направь DNS-запись домена на IP сервера (в панели провайдера домена: A-запись → ВАШ_IP).

Затем:
```bash
certbot --nginx -d ВАШ_ДОМЕН
```

Следуй инструкциям certbot. После этого сайт будет доступен по HTTPS.

### 7.4 — Обновить SERVER_URL в .env

```bash
sed -i 's|SERVER_URL=.*|SERVER_URL=https://ВАШ_ДОМЕН|' /root/tg-beauty/.env
pm2 restart beauty-backend
```

---

## Шаг 8 — Регистрация мастера

После запуска HTTPS открой Mini App в Telegram — приложение автоматически:
1. Авторизует тебя через Telegram
2. Ты сможешь нажать «Зарегистрироваться как мастер» в настройках

Или напрямую через API (из браузера открой DevTools → Console):
```javascript
// После авторизации в приложении
fetch('https://ВАШ_ДОМЕН/v1/master/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('tg_beauty_jwt')
  },
  body: JSON.stringify({ bot_token: 'ВАШ_ТОКЕН_БОТА' })
}).then(r => r.json()).then(console.log)
```

Ответ содержит `master_id` — скопируй его.

---

## Шаг 9 — Подключение фронтенда к бэкенду

В файле `tg-app/api.js` заполни две константы:

```javascript
const API_URL   = 'https://ВАШ_ДОМЕН';      // ← адрес сервера
const MASTER_ID = 'uuid-из-шага-8';          // ← id мастера
```

Сохрани и запушь в GitHub:
```bash
git add tg-app/api.js && git commit -m "Connect frontend to backend" && git push
```

---

## Команды для работы с сервером

| Команда | Что делает |
|---------|------------|
| `pm2 status` | Статус процессов |
| `pm2 logs beauty-backend` | Логи в реальном времени |
| `pm2 restart beauty-backend` | Перезапустить |
| `pm2 stop beauty-backend` | Остановить |

### Обновление кода после изменений

```bash
cd /root/tg-beauty && git pull && cd backend && npm install && npm run build && pm2 restart beauty-backend
```

---

## Структура директорий на сервере

```
/root/tg-beauty/
├── .env                    ← секреты (не в git!)
├── backend/
│   ├── dist/               ← скомпилированный JS
│   ├── src/                ← исходный TypeScript
│   ├── ecosystem.config.js ← конфиг PM2
│   └── package.json
└── tg-app/                 ← статический фронтенд
```

---

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| `curl: (7) Failed to connect` | Сервер не запущен: `pm2 start ecosystem.config.js` |
| `Error: SUPABASE_URL must be set` | Проверь файл `.env`: `cat /root/tg-beauty/.env` |
| PM2 крашится в цикле | Смотри логи: `pm2 logs beauty-backend --lines 50` |
| Webhook не устанавливается | Нет HTTPS — сначала настрой домен и certbot |
| `Permission denied` при SSH | Неверный пароль — сбрось через VNC в панели Beget |
