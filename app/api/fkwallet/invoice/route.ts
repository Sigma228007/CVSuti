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

    // сформируем уникальный orderId
    // сохранять в БД необязательно, но рекомендуется — у тебя должен быть способ сопоставить callback -> заказ
    const orderId = `dep_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    // подпись для формы: md5('merchant:amount:secret1:currency:orderId')
    // FreeKassa docs: подпись для формы содержит currency между secret и orderId
    const sign = md5(`${merchant}:${amount}:${secret1}:${currency}:${orderId}`);

    // можно добавить дополнительные параметры (us_uid или us_login) если есть initData с user
    // попытаемся выдернуть user id из initData (если пришло)
    let us_uid = '';
    try {
      if (body.initData) {
        // initData — это строка вида query_id=...&user=... или telegram initData JSON depending on your flow
        // тут не парсим телеграм подпись — просто пробуем найти цифры
        const m = /id[^\d]*(\d{5,})/.exec(body.initData);
        if (m) us_uid = m[1];
      }
    } catch (e) {}

    // формируем URL
    const base = 'https://pay.freekassa.com/'; // или 'https://pay.fk.money/' в зависимости от кабинета
    const params = new URLSearchParams({
      m: String(merchant),
      oa: String(amount),
      o: String(orderId),
      s: sign,
      currency: currency,
      lang: 'ru',
    });
    if (us_uid) params.set('us_uid', us_uid);

    const url = base + '?' + params.toString();

    // !!! рекомендую: здесь добавить запись в БД: orderId, userId (us_uid), amount, status='pending'
    // чтобы в callback знать, что именно оплачено

    return NextResponse.json({ ok: true, url });
  } catch (err: any) {
    console.error('invoice error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'internal' }, { status: 500 });
  }
}