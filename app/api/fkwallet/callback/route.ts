import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { approveDeposit, getDeposit, markProcessedOnce } from '@/lib/store';
import { notifyUserDepositApproved, notifyUserDepositDeclined } from '@/lib/notify';

/**
 * Документация FreeKassa:
 * sign = md5(MERCHANT_ID:AMOUNT:SECRET2:MERCHANT_ORDER_ID)
 * В callback прилетают поля, среди них MERCHANT_ORDER_ID (наш dep_id) и sign.
 *
 * Важно: FK может прислать повторный callback — защищаемся меткой "once".
 */

function md5(s: string) {
  return crypto.createHash('md5').update(s).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    // FK шлёт form-urlencoded
    const body = await req.formData();
    const MERCHANT_ID = String(body.get('MERCHANT_ID') || '');
    const AMOUNT = String(body.get('AMOUNT') || '');
    const ORDER_ID = String(body.get('MERCHANT_ORDER_ID') || '');
    const SIGN = String(body.get('SIGN') || body.get('sign') || '');

    if (!MERCHANT_ID || !AMOUNT || !ORDER_ID || !SIGN) {
      return NextResponse.json({ ok: false, error: 'bad payload' }, { status: 400 });
    }

    // проверка подписи
    const SECRET2 = process.env.FKW_SECRET2 || process.env.FK_SECRET2 || '';
    if (!SECRET2) {
      return NextResponse.json({ ok: false, error: 'secret2 is not set' }, { status: 500 });
    }
    const my = md5([MERCHANT_ID, AMOUNT, SECRET2, ORDER_ID].join(':'));
    if (my.toLowerCase() !== SIGN.toLowerCase()) {
      return NextResponse.json({ ok: false, error: 'bad sign' }, { status: 400 });
    }

    // защита от дублей
    const onceKey = `fk:${ORDER_ID}`;
    const firstTime = await markProcessedOnce(onceKey, 24 * 60 * 60);
    if (!firstTime) {
      // отвечаем 200, чтоб FK нас не дудосил ретраями
      return NextResponse.json({ ok: true, dedup: true });
    }

    // найдём депозит
    const dep = await getDeposit(ORDER_ID);
    if (!dep) {
      // На крайний случай: FK прислал заказ, которого нет — отвечаем 200, чтобы FK не ретраил.
      return NextResponse.json({ ok: true, warn: 'deposit not found' });
    }

    // Если уже не pending — просто ОК
    if (dep.status !== 'pending') {
      return NextResponse.json({ ok: true, status: dep.status });
    }

    // Зачисляем (пишет историю, меняет статус на approved)
    const updated = await approveDeposit(dep.id);

    // Уведомляем пользователя в Telegram
    if (updated) {
      try {
        await notifyUserDepositApproved({ userId: updated.userId, amount: updated.amount });
      } catch (e) {
        // молча
      }
    }

    // FK важно получить 200/OK
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'internal' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Некоторые кассы умеют дёргать GET — поддержим, чтобы не падать
  return NextResponse.json({ ok: true, method: 'GET' });
}