import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

type TgUser = { id: number; first_name?: string; username?: string };

function verifyInitData(initData: string, botToken: string): { ok: boolean; user?: TgUser } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash') || '';
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const myHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (myHash !== hash) return { ok: false };
    const userStr = params.get('user');
    if (!userStr) return { ok: false };
    const user = JSON.parse(userStr) as TgUser;
    if (!user || typeof user.id !== 'number') return { ok: false };
    return { ok: true, user };
  } catch {
    return { ok: false };
  }
}

/**
 * Создает счёт в FreeKassa (классический URL).
 * ОЖИДАЕТ: { initData?: string; amount: number }
 * ВОЗВРАЩАЕТ: { ok: true, url, orderId, userId? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const initData: string | undefined = body?.initData;
  const amount: number = Number(body?.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'bad amount' }, { status: 400 });
  }

  // Если хотим привязать платёж к пользователю из Telegram WebApp — валидируем initData
  let userId: number | null = null;
  if (initData) {
    const botToken = process.env.BOT_TOKEN || '';
    if (!botToken) {
      return NextResponse.json({ ok: false, error: 'BOT_TOKEN missing' }, { status: 500 });
    }
    const res = verifyInitData(initData, botToken);
    if (!res.ok || !res.user) {
      return NextResponse.json({ ok: false, error: 'bad initData' }, { status: 401 });
    }
    userId = res.user.id;
  }

  const merchant = process.env.FK_MERCHANT_ID || '';
  const secret1 = process.env.FK_SECRET_1 || '';
  // FK_SECRET_2 нужен для callback-подписи, но не для создания ссылки
  if (!merchant || !secret1) {
    return NextResponse.json({ ok: false, error: 'FK config missing' }, { status: 500 });
  }

  // Сгенерим orderId и (рекомендуется) сохранить мапу orderId -> userId в Redis,
  // чтобы в /api/fkwallet/callback понять, кому зачислять баланс.
  // Пример: await redis.hSet('fk:orders', orderId, String(userId ?? ''));
  const orderId = `dep_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;

  // FreeKassa classic signature:
  // md5(merchant_id:amount:secret_word_1:order_id)
  const amountFixed = amount.toFixed(2);
  const sign = crypto
    .createHash('md5')
    .update(`${merchant}:${amountFixed}:${secret1}:${orderId}`)
    .digest('hex');

  // Можно добавлять currency=RUB, описание и т.д.
  const url =
    `https://pay.freekassa.ru/?` +
    `m=${encodeURIComponent(merchant)}` +
    `&oa=${encodeURIComponent(amountFixed)}` +
    `&o=${encodeURIComponent(orderId)}` +
    `&s=${encodeURIComponent(sign)}` +
    `&currency=RUB`;

  return NextResponse.json({ ok: true, url, orderId, userId });
}