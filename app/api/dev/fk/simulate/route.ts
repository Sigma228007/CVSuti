import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function md5(input: string) {
  return crypto.createHash('md5').update(input).digest('hex');
}

export async function POST(req: NextRequest) {
  // Защита: только если явно разрешено в ENV
  if (process.env.ALLOW_TEST_PAY !== '1') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { id?: string; amount?: number };
    const orderId = body.id;
    const amount = Number(body.amount ?? 0);

    if (!orderId || !amount) {
      return NextResponse.json({ ok: false, error: 'no id or amount' }, { status: 400 });
    }

    const merchant = process.env.FK_MERCHANT_ID || '';
    const secret2 = process.env.FK_SECRET_2 || '';
    const currency = process.env.CURRENCY || 'RUB';

    if (!merchant || !secret2) {
      return NextResponse.json({ ok: false, error: 'FK config missing' }, { status: 500 });
    }

    // подпись как у FreeKassa: md5(merchant:amount:secret2:orderId)
    const sign = md5(`${merchant}:${amount}:${secret2}:${orderId}`);

    const params = new URLSearchParams({
      MERCHANT_ID: merchant,
      AMOUNT: String(amount),
      MERCHANT_ORDER_ID: orderId,
      SIGN: sign,
      currency,
      lang: 'ru',
    });

    // отправляем внутренний POST на /api/fkwallet/callback
    // формируем абсолютный url (чтобы Vercel/Next понимал)
    const host = req.headers.get('x-forwarded-host') || (req.nextUrl && req.nextUrl.host) || 'localhost:3000';
    const proto = (req.headers.get('x-forwarded-proto') || 'https').replace(/:$/,'');
    const base = (process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`).replace(/\/+$/, '');
    const callbackUrl = `${base}/api/fkwallet/callback`;

    const r = await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const text = await r.text().catch(() => '');
    return NextResponse.json({ ok: true, status: r.status, response: text });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}