import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyInitData } from '@/lib/sign';

function md5(s: string) {
  return crypto.createHash('md5').update(s).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const botToken = process.env.BOT_TOKEN || '';
    const merchant = process.env.FK_MERCHANT_ID || '';
    const secret1  = process.env.FK_SECRET_1 || '';
    const currency = process.env.CURRENCY || 'RUB';

    if (!botToken)  return NextResponse.json({ ok: false, error: 'BOT_TOKEN missing' }, { status: 500 });
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: 'FK config missing' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));
    const amountRaw: number = body?.amount;

    // initData: из заголовка x-init-data или query ?tgWebAppData=
    const fromHeader = req.headers.get('x-init-data') || '';
    const fromQuery  = req.nextUrl.searchParams.get('tgWebAppData') || '';
    const initData   = fromHeader || body?.initData || fromQuery;

    if (!initData) return NextResponse.json({ ok: false, error: 'no initData' }, { status: 401 });

    const parsed = verifyInitData(initData, botToken); // { ok: true, user } | { ok: false }
    if (!parsed.ok || !parsed.user) {
      return NextResponse.json({ ok: false, error: 'bad initData' }, { status: 401 });
    }
    const userId = parsed.user.id;

    const amount = Math.max(1, Math.floor(Number(amountRaw || 0))).toString(); // целые ₽
    const orderId = `dep_${Date.now()}_${userId}`;

    // подпись Classic
    const sign = md5(`${merchant}:${amount}:${secret1}:${orderId}`);

    // Важно: используем .COM
    const url = `https://pay.freekassa.com/?m=${merchant}` +
      `&oa=${encodeURIComponent(amount)}` +
      `&o=${encodeURIComponent(orderId)}` +
      `&currency=${encodeURIComponent(currency)}` +
      `&us_user=${encodeURIComponent(String(userId))}` +
      `&us_uid=${encodeURIComponent(String(userId))}` +
      `&s=${sign}`;

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}