import { NextResponse } from 'next/server';
import crypto from 'crypto';

function md5(input: string) {
  return crypto.createHash('md5').update(input).digest('hex');
}

export async function POST(req: Request) {
  // Freekassa может присылать form-data (application/x-www-form-urlencoded)
  const contentType = req.headers.get('content-type') || '';
  let params: URLSearchParams | null = null;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    params = new URLSearchParams(text);
  } else if (contentType.includes('multipart/form-data')) {
    // Next.js app router не даёт convenient multipart parsing — но freekassa обычно присылает urlencoded
    const text = await req.text();
    params = new URLSearchParams(text);
  } else {
    // fallback parse json
    try {
      const json = await req.json();
      params = new URLSearchParams();
      for (const k of Object.keys(json)) params.set(k, String((json as any)[k]));
    } catch (e) {
      return new Response('BAD REQUEST', { status: 400 });
    }
  }

  const merchantId = params.get('MERCHANT_ID') || params.get('merchant_id') || params.get('m');
  const amount = params.get('AMOUNT') || params.get('oa') || params.get('amount');
  const orderId = params.get('MERCHANT_ORDER_ID') || params.get('merchant_order_id') || params.get('o');
  const sign = params.get('SIGN') || params.get('s');

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

  // OPTIONAL: здесь проверить IP отправителя (Freekassa даёт список IP в доках)
  // OPTIONAL: проверить, что сумма совпадает с тем, что у тебя в БД по orderId
  // У тебя должно быть в БД orderId -> userId, amount, status
  // если всё ок — зачесть деньги пользователю в базе

  // если все ок — отвечаем YES (строго так)
  return new Response('YES');
}