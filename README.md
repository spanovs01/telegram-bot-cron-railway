# Telegram Bot + Cron starter (Bun + Hono on Railway)

Ultra-minimal starter: two bot commands (`/start`, `/help`), a cron trigger endpoint, and Hono/Bun server ready for Railway.

## Prerequisites
- Bun `>=1.1` (or Docker for local testing)
- Telegram Bot Token
- Railway project with public URL + Cron

## Environment
Create `.env` (see `env.example`):
```env
BOT_TOKEN=your-telegram-bot-token
CRON_SECRET=super-secret-string   # For /cron/trigger auth
PORT=8080                         # Optional; Railway sets PORT automatically
TG_CHAT_ID=1234567                # Optional; For testing cron triggers
```

## Run locally (Without Docker)
```bash
bun install
bun run dev
# Webhook:  http://localhost:8080/telegram-webhook
# Cron:     http://localhost:8080/cron/trigger  (POST with Authorization: Bearer $CRON_SECRET)
```

## Storage & Broadcast Mode
Бот использует встроенный в Bun модуль `bun:sqlite` для хранения списка подписанных пользователей (`chat_id`).
- При отправке команды `/start` или любого сообщения боту, пользователь автоматически добавляется в базу данных (таблица `subscribers`).
- При вызове эндпоинта `/cron/trigger`, сообщение рассылается (broadcasting) абсолютно всем пользователям, которые есть в базе.
- **Railway Volume**: Для того чтобы база данных (`users.db`) не удалялась при каждом деплое на Railway, необходимо подключить Railway Volume к вашему сервису, примонтировать его (например, по пути `/app/data`) и задать переменную окружения `DB_PATH=/app/data/users.db`.

## Test cron trigger (local)
```bash
source .env && curl -X POST http://localhost:8080/cron/trigger \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"test\",\"message\":\"Cron test ping\"}"
```

## Deploy to Railway
1) Create a new Railway service from this repo.
2) Set env vars from the list above.
3) Приложение использует стандартный для Railway способ запуска через `export default { ... }` в `src/worker.ts`, что обеспечивает идеальную совместимость.
4) Start command: `bun run start` (Railway's auto-detect will pick it up properly).
5) Add a Railway Cron hitting `POST /cron/trigger` with header `Authorization: Bearer $CRON_SECRET`.

### Railway Function cron trigger
- In Railway Functions, create a new scheduled function (e.g. `cron-ping`) and paste the contents of `railway-cron-function.ts`.
- Replace `REPLACE_WITH_YOUR_RAILWAY_DOMAIN` in the `url` with your service's internal hostname (e.g. `myapp.up.railway.app` → `myapp.railway.internal`).
- Set `CRON_SECRET` and `TG_CHAT_ID` as env vars for the function so it can authorize and target the chat.

## Telegram webhook
Point Telegram to your Railway URL:
```bash
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<your-railway-domain>/telegram-webhook"}'
```

## Bot commands helper
```bash
bun run scripts/setupBotCommands.ts          # set /start and /help
bun run scripts/setupBotCommands.ts list     # list
bun run scripts/setupBotCommands.ts clear    # clear
bun run scripts/setupBotCommands.ts check    # validate token
```

## Endpoints
- `GET /` — root handler to quickly verify server is running
- `GET /healthz` — health check
- `POST /telegram-webhook` — Telegram webhook handler
- `POST /cron/trigger` — Cron entrypoint (Authorization: `Bearer $CRON_SECRET`)
