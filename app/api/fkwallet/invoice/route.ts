import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyInitData } from '@/lib/sign';
import { createDepositRequest } from '@/lib/store';

type Body = { amount?: number; initData?: string };

function md5(s: string) { return crypto.createHash('md5').update(s).digest('hex'); }

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const amount = Number(body.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'bad amount' }, { status: 400 });
    }

    const merchant = process.env.FK_MERCHANT_ID || '';
    const secret1  = process.env.FK_SECRET_1 || '';
    const currency = process.env.CURRENCY || 'RUB';
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: 'FK config missing' }, { status: 500 });
    }

    // userId из initData (если WebApp)
    let userId = 0;
    try {
      const bot = process.env.BOT_TOKEN || '';
      if (bot && body.initData) {
        const v = verifyInitData(body.initData, bot);
        if (v.ok) userId = v.user.id;
      }
    } catch {}

    // 1) создаём pending-депозит
    const dep = await createDepositRequest(userId, Math.floor(amount), 'fkwallet', null);

    // 2) orderId = dep.id (так callback сможет найти запись)
    const orderId = dep.id;
    const sign = md5(`${merchant}:${dep.amount}:${secret1}:${currency}:${orderId}`);

    // 3) ссылка FreeKassa
    const params = new URLSearchParams({
      m: String(merchant),
      oa: String(dep.amount),
      o: String(orderId),
      s: sign,
      currency,
      lang: 'ru',
      us_dep: orderId,
      ...(userId ? { us_uid: String(userId) } : {}),
    });
    const url = 'https://pay.freekassa.com/?' + params.toString();

    return NextResponse.json({ ok: true, url, id: dep.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'internal' }, { status: 500 });
  }
}