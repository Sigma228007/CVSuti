import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { addBalance } from '@/lib/store';
import { redis } from '@/lib/redis';

function md5(s: string) {
  return crypto.createHash('md5').update(s).digest('hex');
}

function pick(fd: FormData, ...names: string[]) {
  for (const n of names) {
    const v = fd.get(n);
    if (typeof v === 'string' && v.length) return v;
  }
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const merchant = process.env.FK_MERCHANT_ID || '';
    const secret2  = process.env.FK_SECRET_2 || '';
    if (!merchant || !secret2) {
      return new Response('config', { status: 500 });
    }

    const fd = await req.formData();

    // FreeKassa может прислать разные ключи
    const m        = pick(fd, 'MERCHANT_ID', 'm');
    const amount   = pick(fd, 'AMOUNT', 'oa', 'amount');
    const orderId  = pick(fd, 'MERCHANT_ORDER_ID', 'o', 'order_id');
    const sign     = pick(fd, 'SIGN', 's', 'sign');

    if (!m || !amount || !orderId || !sign) {
      return new Response('BAD', { status: 400 });
    }

    // проверка подписи callback по SECRET #2
    const expected = md5(`${merchant}:${amount}:${secret2}:${orderId}`).toLowerCase();
    if (sign.toLowerCase() !== expected) {
      return new Response('BAD SIGN', { status: 400 });
    }

    // защита от дублей колбэка
    try {
      const r = await redis();
      const key = `fk:done:${orderId}`;
      const set = await r.set(key, '1', { NX: true, EX: 7 * 24 * 3600 }); // 7 дней
      if (!set) {
        // уже зачисляли — вернуть OK ещё раз
        return new Response('OK');
      }
    } catch {}

    // userId — из orderId dep_<timestamp>_<userId> или из us_user/us_uid
    let uid = 0;
    const parts = orderId.split('_');
    if (parts.length >= 3) {
      uid = Number(parts[2]);
    } else {
      const usUser = pick(fd, 'us_user', 'us_uid');
      uid = Number(usUser || 0);
    }
    if (!uid) return new Response('BAD UID', { status: 400 });

    // сумма целыми ₽
    const rub = Math.max(1, Math.floor(Number(amount || '0')));
    await addBalance(uid, rub);

    // FreeKassa ожидает простой 200-OK (многие шлюзы принимают "OK")
    return new Response('OK');
  } catch {
    return new Response('ERR', { status: 500 });
  }
}