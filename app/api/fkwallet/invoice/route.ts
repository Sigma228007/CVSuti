import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyInitData } from '@/lib/sign';
import { createDepositRequest } from '@/lib/store';

// Возвращает { ok, id, url } — ВСЕГДА, даже если initData пустой.
// userId ставим 0, если не смогли вытащить из initData (нормально для оплаты).
type Body = { amount?: number; initData?: string };

function md5(s: string) { return crypto.createHash('md5').update(s).digest('hex'); }

export async function POST(req: Request) {
  try {
    const merchant = process.env.FK_MERCHANT_ID || '';
    const secret1  = process.env.FK_SECRET_1 || '';
    const currency = process.env.CURRENCY || 'RUB';
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: 'FK config missing (FK_MERCHANT_ID/FK_SECRET_1)' }, { status: 500 });
    }

    // читаем тело
    const body = (await req.json().catch(() => ({}))) as Body;
    const amount = Number(body?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'bad amount' }, { status: 400 });
    }

    // Пытаемся вытащить userId из initData, НО это НЕ обязательно.
    // Если нет/невалидно — используем userId=0.
    let userId = 0;
    const botToken = process.env.BOT_TOKEN || '';
    const headerInit = (req.headers as any).get?.('x-init-data') || '';
    const initData = headerInit || body?.initData || '';
    if (botToken && initData) {
      try {
        const v = verifyInitData(initData, botToken);
        if (v.ok) userId = v.user.id;
      } catch {}
    }

    // 1) создаём pending-депозит (метод fkwallet)
    const dep = await createDepositRequest(userId, Math.floor(amount), 'fkwallet', null);

    // 2) формируем подпись ссылки FK: md5(merchant:amount:secret1:currency:orderId)
    const orderId = dep.id;
    const sign = md5(`${merchant}:${dep.amount}:${secret1}:${currency}:${orderId}`);

    // 3) выдаём ссылку на кассу
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
    return NextResponse.json({ ok: true, id: dep.id, url });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'internal' }, { status: 500 });
  }
}