import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyInitData } from '@/lib/sign';

function getBaseUrl(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/+$/, '');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  return `${proto}://${host}`;
}

/**
 * POST { initData, amount }
 * -> { ok: true, url }
 */
export async function POST(req: NextRequest) {
  try {
    const { initData, amount } = await req.json();
    const botToken = process.env.BOT_TOKEN!;
    const parsed = verifyInitData(initData, botToken);
    if (!parsed || !parsed.user?.id) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const uid = Number(parsed.user.id);
    const amt = Math.max(1, Math.floor(Number(amount || 0)));

    const mId = process.env.FK_MERCHANT_ID!;
    const s1  = process.env.FK_SECRET_1!;
    const base = getBaseUrl(req);

    // Заказ/инвойс
    const orderId = `fk_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

    // Подпись для ссылки оплаты: md5(MERCHANT_ID:AMOUNT:SECRET_1:ORDER_ID)
    const sign = crypto.createHash('md5').update(`${mId}:${amt}:${s1}:${orderId}`).digest('hex');

    // Документация FK: https://pay.freekassa.ru/?m={m}&oa={amount}&o={order_id}&s={sign}&us_user={uid}&currency=RUB
    const url = new URL('https://pay.freekassa.ru/');
    url.searchParams.set('m', mId);
    url.searchParams.set('oa', String(amt));
    url.searchParams.set('o', orderId);
    url.searchParams.set('s', sign);
    url.searchParams.set('us_user', String(uid));
    url.searchParams.set('currency', 'RUB');
    // (опц.) странички успех/ошибка — укажем наш домен, если хочешь
    url.searchParams.set('success_url', `${base}/`);
    url.searchParams.set('failure_url', `${base}/`);

    return NextResponse.json({ ok: true, url: url.toString() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}