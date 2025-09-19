import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { markProcessedOnce, approveDeposit, getDeposit } from '@/lib/store';

function md5(input: string) {
  return crypto.createHash('md5').update(input).digest('hex');
}

export async function POST(req: Request) {
  // Разные клиенты FK присылают urlencoded. Разбираем любые варианты.
  const contentType = req.headers.get('content-type') || '';
  let params: URLSearchParams | null = null;

  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      params = new URLSearchParams(text);
    } else if (contentType.includes('multipart/form-data')) {
      const text = await req.text();
      params = new URLSearchParams(text);
    } else {
      const json = await req.json();
      params = new URLSearchParams();
      for (const k of Object.keys(json)) params.set(k, String((json as any)[k]));
    }
  } catch {
    return new Response('BAD REQUEST', { status: 400 });
  }

  const merchantId = params.get('MERCHANT_ID') || params.get('merchant_id') || params.get('m') || '';
  const amountStr  = params.get('AMOUNT') || params.get('oa') || params.get('amount') || '';
  const orderId    = params.get('MERCHANT_ORDER_ID') || params.get('merchant_order_id') || params.get('o') || '';
  const sign       = params.get('SIGN') || params.get('s') || '';

  const secret2 = process.env.FK_SECRET_2 || '';
  if (!merchantId || !amountStr || !orderId || !sign || !secret2) {
    return new Response('BAD REQUEST', { status: 400 });
  }

  // проверка подписи FK: md5(merchant:amount:secret2:orderId)
  const check = md5(`${merchantId}:${amountStr}:${secret2}:${orderId}`);
  if (check.toLowerCase() !== sign.toLowerCase()) {
    console.warn('FK callback bad sign', { check, sign });
    return new Response('WRONG SIGN', { status: 400 });
  }

  // защита от дублей (каждый orderId — один раз)
  const first = await markProcessedOnce(orderId, 2 * 24 * 60 * 60);
  if (!first) {
    return new Response('YES'); // повтор — но ОК
  }

  // ВАЖНО: мы в /api/pay/start сделали orderId = dep.id
  const dep = await getDeposit(orderId);
  if (!dep) {
    console.error('FK callback: deposit not found', { orderId });
    return new Response('YES'); // не валим FK, но логируем
  }

  // Доп. сверки (сумма)
  const paid = Math.floor(Number(amountStr));
  if (!Number.isFinite(paid) || paid <= 0 || paid !== dep.amount) {
    console.warn('FK callback: amount mismatch', { expected: dep.amount, paid });
    // можно отклонять или принимать — оставим как отклонение
    return new Response('BAD AMOUNT', { status: 400 });
  }

  // Авто-зачисление
  await approveDeposit(dep.id);

  // Для FreeKassa важно ответить "YES"
  return new Response('YES');
}