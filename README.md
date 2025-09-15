# Nvuti‑style Telegram Mini App (Next.js)


## Локально
1. `npm i`
2. `.env.local` из `.env.example` (заполни `BOT_TOKEN`, `SERVER_SEED`).
3. `npm run dev` → http://localhost:3000


## Vercel
— Добавь переменные окружения: `BOT_TOKEN`, `SERVER_SEED`, `HOUSE_EDGE_BP` (например 150).
— Задеплой, прод‑URL вставь в BotFather → Configure Web App.


## Ограничения
— Ставка: **1–10 000 ₽**.
— Шанс: **1–95%**. Коэффициент = `(100% − edge)/шанс`.


## В продакшене
— Подключи БД (Postgres + Prisma): балансы/ставки/транзакции.
— Подключи платежи: провайдер, вебхуки, статусы, AML/KYC, лимиты.
— Добавь антиспам, rate‑limit, логирование, мониторинг.


## Проведённая честность
`value = HMAC_SHA256(serverSeed, "+clientSeed:+nonce+") → hex → 0..999999`
Публикуем `SHA256(serverSeed)`. Ротируем seed и публикуем старые для верификации.