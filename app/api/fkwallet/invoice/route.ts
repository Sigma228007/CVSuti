import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// --- Вспомогательная: проверка initData от Telegram Mini App ---
type TgUser = { id: number; first_name?: string; username?: string };

function verifyInitDataAndGetUserId(initData: string, botToken: string): number | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash') || '';
    if (!hash) return null;

    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const myHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (myHash !== hash) return null;

    const userStr = params.get('user');
    if (!userStr) return null;

    const user = JSON.parse(userStr) as TgUser;
    if (!user?.id || typeof user.id !== 'number') return null;

    return user.id;
  } catch {
    return null;
  }
}

// --- Подпись FreeKassa (classic) ---
function md5(s: string) {
  return crypto.createHash('md5').update(s).digest('hex');
}

/**
 * Создание инвойса в FreeKassa / FKWallet.
 * Тело запроса: { amount: number, initData?: string }
 * Ответ: { ok: true, url: string } | { ok: false, error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { amount, initData } = (await req.json()) as { amount: number; initData?: string };

    // 1) Валидируем сумму
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'bad amount' }, { status: 400 });
    }

    // 2) Валидируем/парсим initData
    const botToken = process.env.BOT_TOKEN || '';
    if (!botToken) {
      return NextResponse.json({ ok: false, error: 'BOT_TOKEN missing' }, { status: 500 });
    }
    if (!initData) {
      return NextResponse.json({ ok: false, error: 'no initData' }, { status: 401 });
    }
    const userId = verifyInitDataAndGetUserId(initData, botToken);
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'bad initData' }, { status: 401 });
    }

    // 3) Настройки FK из env
    const merchant = process.env.FK_MERCHANT_ID || '';
    const secret1 = process.env.FK_SECRET_1 || '';
    const currency = process.env.CURRENCY || 'RUB';
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: 'FK config missing' }, { status: 500 });
    }

    // 4) Формируем заказ
    const orderId = `dep_${Date.now()}_${userId}_${Math.floor(Math.random() * 1e6)}`;

    // 5) Подпись (classic): md5(merchant:amount:secret1:orderId)
    const sign = md5(`${merchant}:${amount}:${secret1}:${orderId}`);

    // 6) Домен оплаты.
    // Если хочешь форсировать pay.freekassa.ru — задай FK_GATE=https://pay.freekassa.ru/merchant/cash.php
    // По умолчанию используем .com (как ты и просил)
    const gate = (process.env.FK_GATE || 'https://pay.freekassa.com/merchant/cash.php').replace(/\/+$/, '');

    // 7) Параметры оплаты (classic)
    const qs = new URLSearchParams({
      m: merchant,                  // merchant id
      oa: String(amount),           // сумма
      o: orderId,                   // номер заказа
      currency,                     // валюта
      s: sign,                      // подпись
      lang: 'ru',
      // Кастомные поля (помогают на callback)
      'us_user': String(userId),
      'us_order': orderId,
      'us_src': 'webapp',
    });

    const url = `${gate}?${qs.toString()}`;

    // (не трогаю твоё хранилище pending — если нужно, здесь можно записать orderId -> userId/amount)

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}