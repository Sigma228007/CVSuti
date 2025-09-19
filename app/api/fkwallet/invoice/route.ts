import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyInitData } from '@/lib/sign';
import { createDepositRequest } from '@/lib/store';
import { getBaseUrl } from '@/lib/config';

type Body = { amount?: number; initData?: string };

function md5(input: string) {
  return crypto.createHash('md5').update(input).digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const amount = Number(body.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'bad amount' }, { status: 400 });
    }

    const merchant = process.env.FK_MERCHANT_ID || '';
    const secret1 = process.env.FK_SECRET_1 || '';
    const currency = process.env.CURRENCY || 'RUB';
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: 'FK config missing' }, { status: 500 });
    }

    // Определяем userId из initData (если запущено в Telegram)
    let userId = 0;
    try {
      const bot = process.env.BOT_TOKEN || '';
      if (bot && body.initData) {
        const v = verifyInitData(body.initData, bot);
        if (v.ok) userId = v.user.id;
      }
    } catch {}

    // 1) создаём запись депозита (pending)
    const dep = await createDepositRequest(userId, Math.floor(amount), 'fkwallet', null);

    // 2) orderId = id депозита (чтобы мы могли связать callback/статусы)
    const orderId = dep.id;

    // 3) подпись FreeKassa для формы: md5(merchant:amount:secret1:currency:orderId)
    const sign = md5(`${merchant}:${amount}:${secret1}:${currency}:${orderId}`);

    // 4) формируем ссылку на оплату
    //  - success URL задаётся в кабинете FK (если нужно – можно сделать отдельными страницами /fk/success и /fk/error)
    const params = new URLSearchParams({
      m: String(merchant),
      oa: String(amount),
      o: String(orderId),
      s: sign,
      currency: currency,
      lang: 'ru',
      // дополнительные параметры (попадут в callback FK)
      us_dep: orderId,
      ...(userId ? { us_uid: String(userId) } : {}),
    });

    const base = 'https://pay.freekassa.com/'; // или https://pay.fk.money/ — в зависимости от кабинета
    const url = base + '?' + params.toString();

    // 5) возвращаем и ссылку, и id депозита
    return NextResponse.json({ ok: true, url, id: dep.id });
  } catch (err: any) {
    console.error('invoice error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'internal' }, { status: 500 });
  }
}