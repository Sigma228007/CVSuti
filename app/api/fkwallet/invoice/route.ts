import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyInitData } from '@/lib/sign';
import { createDepositRequest } from '@/lib/store';

type Body = { amount?: number; initData?: string };

function md5(s: string) { return crypto.createHash('md5').update(s).digest('hex'); }

export async function POST(req: Request) {
  try {
    const merchant = process.env.FK_MERCHANT_ID || '';
    const secret1  = process.env.FK_SECRET_1 || '';
    const currency = process.env.CURRENCY || 'RUB';
    const botToken = process.env.BOT_TOKEN || '';
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: 'FK config missing (FK_MERCHANT_ID / FK_SECRET_1)' }, { status: 500 });
    }
    if (!botToken) {
      return NextResponse.json({ ok: false, error: 'BOT_TOKEN missing' }, { status: 500 });
    }

    // initData: из заголовка ИЛИ из body
    const headerInit = (req.headers as any).get?.('x-init-data') || '';
    const body = (await req.json().catch(() => ({}))) as Body;
    const amount = Number(body?.amount || 0);
    const initData = headerInit || body?.initData || '';

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'bad amount' }, { status: 400 });
    }

    // Если запускают из TG — проверяем initData. Если пусто — вернём понятную ошибку.
    const parsed = verifyInitData(initData, botToken);
    if (!('ok' in parsed) || !parsed.ok || !parsed.user?.id) {
      return NextResponse.json({ ok: false, error: 'no initData (run from Telegram WebApp)' }, { status: 401 });
    }
    const userId = parsed.user.id;

    // 1) создаём pending-депозит
    const dep = await createDepositRequest(userId, Math.floor(amount), 'fkwallet', null);

    // 2) orderId = dep.id, sign = md5(merchant:amount:secret1:currency:orderId)
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
      us_uid: String(userId),
    });
    const url = 'https://pay.freekassa.com/?' + params.toString();

    return NextResponse.json({ ok: true, id: dep.id, url });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'internal' }, { status: 500 });
  }
}