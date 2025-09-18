import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { addBalance } from '@/lib/store';

/**
 * FreeKassa колбэк может присылать:
 * - MERCHANT_ID
 * - AMOUNT (или oa)
 * - MERCHANT_ORDER_ID (или o)
 * - SIGN (подпись) = md5(MERCHANT_ID:AMOUNT:SECRET_2:ORDER_ID)
 * - us_user (наш uid, переданный в invoice)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const mId = url.searchParams.get('MERCHANT_ID') || url.searchParams.get('m');
    const amount = url.searchParams.get('AMOUNT') || url.searchParams.get('oa');
    const orderId = url.searchParams.get('MERCHANT_ORDER_ID') || url.searchParams.get('o');
    const sign = (url.searchParams.get('SIGN') || url.searchParams.get('s') || '').toLowerCase();
    const uid = Number(url.searchParams.get('us_user') || '0');

    if (!mId || !amount || !orderId || !sign || !uid) {
      return NextResponse.json({ ok: false, error: 'bad_params' }, { status: 400 });
    }

    const s2 = process.env.FK_SECRET_2!;
    const my = crypto.createHash('md5').update(`${mId}:${amount}:${s2}:${orderId}`).digest('hex').toLowerCase();

    if (my !== sign) {
      return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 400 });
    }

    await addBalance(uid, Math.floor(Number(amount)));
    // FK ожидает простой текст «YES» при успешной обработке.
    return new NextResponse('YES', { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}