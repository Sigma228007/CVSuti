import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData } from '@/lib/sign';
import { createDepositRequest } from '@/lib/store';

/**
 * Возвращает { ok, id, url }
 * - id  — идентификатор депозита (dep_...)
 * - url — ссылка FreeKassa для оплаты
 */
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

    // initData из заголовка X-Init-Data ИЛИ из body
    const headerInit = req.headers.get('x-init-data') || '';
    const { amount, initData: bodyInit } = (await req.json().catch(() => ({}))) as {
      amount?: number; initData?: string;
    };

    const initData = headerInit || bodyInit || '';
    const amt = Number(amount || 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ ok: false, error: 'bad amount' }, { status: 400 });
    }

    const parsed = verifyInitData(initData, botToken);
    if (!('ok' in parsed) || !parsed.ok || !parsed.user?.id) {
      return NextResponse.json({ ok: false, error: 'no initData' }, { status: 401 });
    }

    const userId = parsed.user.id;

    // создаём pending депозит, метод — fkwallet
    const dep = await createDepositRequest(userId, Math.floor(amt), 'fkwallet', null);

    // Собираем сигнатуру формы FK: md5(merchant:amount:secret1:currency:order)
    const crypto = await import('crypto');
    const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex');

    const orderId = dep.id; // критично: привязываем orderId к нашему депу!
    const sign = md5(`${merchant}:${dep.amount}:${secret1}:${currency}:${orderId}`);

    const base = 'https://pay.freekassa.com/';
    const params = new URLSearchParams({
      m: String(merchant),
      oa: String(dep.amount),
      o: String(orderId),
      s: sign,
      currency,
      lang: 'ru',
    });

    const url = `${base}?${params.toString()}`;

    return NextResponse.json({ ok: true, id: dep.id, url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'server_error' }, { status: 500 });
  }
}