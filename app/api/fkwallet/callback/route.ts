import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDeposit, approveDeposit, markProcessedOnce } from '@/lib/store';

function md5(s: string) { return crypto.createHash('md5').update(s).digest('hex'); }

export async function POST(req: Request) {
  // Freekassa шлёт form-urlencoded или multipart — берём сырым текстом и парсим SearchParams
  const contentType = req.headers.get('content-type') || '';
  let params: URLSearchParams;
  try {
    const text = await req.text();
    params = new URLSearchParams(text);
  } catch {
    return new Response('BAD REQUEST', { status: 400 });
  }

  const merchantId = params.get('MERCHANT_ID') || params.get('merchant_id') || params.get('m') || '';
  const amount     = params.get('AMOUNT')       || params.get('oa')            || params.get('amount') || '';
  const orderId    = params.get('MERCHANT_ORDER_ID') || params.get('merchant_order_id') || params.get('o') || '';
  const sign       = params.get('SIGN')         || params.get('s')             || '';

  const secret2 = process.env.FK_SECRET_2 || '';
  if (!merchantId || !amount || !orderId || !sign || !secret2) {
    return new Response('BAD REQUEST', { status: 400 });
  }

  // подпись: md5(merchant:amount:secret2:orderId)
  const check = md5(`${merchantId}:${amount}:${secret2}:${orderId}`);
  if (check.toLowerCase() !== sign.toLowerCase()) {
    console.warn('FK callback bad sign', { check, sign });
    return new Response('WRONG SIGN', { status: 400 });
  }

  // защита от дублей
  const firstTime = await markProcessedOnce(orderId);
  if (!firstTime) {
    return new Response('YES'); // уже обработано ранее
  }

  // ищем депозит
  const dep = await getDeposit(orderId);
  if (!dep) {
    console.warn('FK callback: deposit not found', { orderId });
    return new Response('YES'); // отвечаем YES, чтобы FK не ретраила, но лог пишем
  }

  // апрувим (approveDeposit внутри сам зачислит баланс через addBalance)
  await approveDeposit(dep.id);

  // Отвечаем строго "YES"
  return new Response('YES');
}