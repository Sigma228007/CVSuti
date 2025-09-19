import { NextResponse } from 'next/server';
import crypto from 'crypto';

type Body = { amount?: number; initData?: string };

function md5(input: string) {
  return crypto.createHash('md5').update(input).digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const amount = Number(body.amount || 0);
    if (!amount || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'bad amount' }, { status: 400 });
    }

    const merchant = process.env.FK_MERCHANT_ID || '';
    const secret1 = process.env.FK_SECRET_1 || '';
    const currency = process.env.CURRENCY || 'RUB';
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: 'FK config missing' }, { status: 500 });
    }

    const orderId = `dep_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const sign = md5(`${merchant}:${amount}:${secret1}:${currency}:${orderId}`);

    let us_uid = '';
    try {
      if (body.initData) {
        const m = /id[^\d]*(\d{5,})/.exec(body.initData);
        if (m) us_uid = m[1];
      }
    } catch {}

    const params = new URLSearchParams({
      m: String(merchant),
      oa: String(amount),
      o: String(orderId),
      s: sign,
      currency,
      lang: 'ru',
    });
    if (us_uid) params.set('us_uid', us_uid);

    // Абсолютный URL на наш прокси /go/fk
    const envBase = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const reqUrl = new URL(req.url);
    const host = (req.headers.get('x-forwarded-host') || reqUrl.host);
    const proto = (req.headers.get('x-forwarded-proto') || reqUrl.protocol.replace(':','')) || 'https';
    const origin = `${proto}://${host}`;
    const baseUrl = envBase || origin;
    const proxyUrl = `${baseUrl}/go/fk?${params.toString()}`;

    return NextResponse.json({ ok: true, url: proxyUrl });
  } catch (err: any) {
    console.error('invoice error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'internal' }, { status: 500 });
  }
}