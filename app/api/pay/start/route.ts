import { NextResponse } from 'next/server';
import { verifyInitData } from '@/lib/sign';
import { createDepositRequest } from '@/lib/store';
import crypto from 'crypto';

type Body = { amount?: number; initData?: string; method?: 'fkwallet' | 'crypto' };

function md5(input: string) {
  return crypto.createHash('md5').update(input).digest('hex');
}

export async function POST(req: Request) {
  try {
    const { amount, initData, method } = (await req.json()) as Body;

    if (!process.env.BOT_TOKEN) {
      return NextResponse.json({ ok: false, error: 'BOT_TOKEN missing' }, { status: 500 });
    }
    if (!initData) {
      return NextResponse.json({ ok: false, error: 'no initData' }, { status: 401 });
    }

    const v = verifyInitData(initData, process.env.BOT_TOKEN);
    if (!v.ok || !v.user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const amt = Math.floor(Number(amount || 0));
    if (!amt || amt <= 0) {
      return NextResponse.json({ ok: false, error: 'bad amount' }, { status: 400 });
    }

    // создаём pending-заявку
    const dep = await createDepositRequest(v.user.id, amt, 'fkwallet', { kind: method || 'fkwallet' });

    // формируем ссылку FK с orderId = dep.id
    const merchant = process.env.FK_MERCHANT_ID || '';
    const secret1  = process.env.FK_SECRET_1 || '';
    const currency = process.env.CURRENCY || 'RUB';
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: 'FK config missing' }, { status: 500 });
    }

    const orderId = dep.id;
    const sign = md5(`${merchant}:${amt}:${secret1}:${currency}:${orderId}`);

    const params = new URLSearchParams({
      m: String(merchant),
      oa: String(amt),
      o: String(orderId),
      s: sign,
      currency,
      lang: 'ru',
    });

    // абсолютный URL до нашего прокси /go/fk
    const envBase = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const reqUrl = new URL(req.url);
    const host = (req.headers.get('x-forwarded-host') || reqUrl.host);
    const proto = (req.headers.get('x-forwarded-proto') || reqUrl.protocol.replace(':','')) || 'https';
    const origin = `${proto}://${host}`;
    const baseUrl = envBase || origin;
    const payUrl = `${baseUrl}/go/fk?${params.toString()}`;

    return NextResponse.json({ ok: true, id: dep.id, url: payUrl, amount: amt });
  } catch (e: any) {
    console.error('pay/start error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'internal' }, { status: 500 });
  }
}