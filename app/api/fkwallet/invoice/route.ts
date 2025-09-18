import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

type TgUser = { id: number };

function verifyInitDataString(initData: string, botToken: string): { ok: boolean; user?: TgUser } {
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

    return { ok: true, user };
  } catch {
    return { ok: false };
  }
}

// md5 по правилам FreeKassa (classic)
function md5(s: string) {
  return crypto.createHash('md5').update(s).digest('hex');
}

export async function POST(req: NextRequest) {
  const botToken = process.env.BOT_TOKEN || '';
  const merchant = process.env.FK_MERCHANT_ID || '';
  const secret1 = process.env.FK_SECRET_1 || '';
  const currency = process.env.CURRENCY || 'RUB';

  if (!botToken) return NextResponse.json({ ok: false, error: 'BOT_TOKEN missing' }, { status: 500 });
  if (!merchant || !secret1) {
    return NextResponse.json({ ok: false, error: 'FK config missing' }, { status: 500 });
  }

  const initData = req.nextUrl.searchParams.get('initData') || '';
  if (!initData) return NextResponse.json({ ok: false, error: 'no initData' }, { status: 401 });

  const v = verifyInitDataString(initData, botToken);
  if (!v.ok || !v.user) {
    return NextResponse.json({ ok: false, error: 'bad initData' }, { status: 401 });
  }

  const { amount } = (await req.json().catch(() => ({}))) as { amount?: number };
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'bad amount' }, { status: 400 });
  }

  // orderId — любой уникальный идентификатор
  const orderId = `dep_${Date.now()}_${v.user.id}_${Math.floor(Math.random() * 1e6)}`;

  // подпись FreeKassa classic: md5(merchant:amount:secret1:orderId)
  const sign = md5(`${merchant}:${amount}:${secret1}:${orderId}`);

  // Собираем ссылку на оплату (домен .com корректен)
  const url = new URL('https://pay.freekassa.com/');
  url.searchParams.set('m', merchant);
  url.searchParams.set('oa', String(amount));
  url.searchParams.set('o', orderId);
  url.searchParams.set('currency', currency);
  url.searchParams.set('s', sign);
  // Пользовательские поля (удобно передать userId)
  url.searchParams.set('us_user', String(v.user.id));
  url.searchParams.set('us_uid', String(v.user.id));

  return NextResponse.json({ ok: true, url: url.toString() });
}