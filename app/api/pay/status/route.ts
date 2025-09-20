import { NextRequest, NextResponse } from 'next/server';
import { getDeposit } from '@/lib/store';

/**
 * Публичный статус по dep.id
 * Не требует initData — его дергает страница /pay/[id] для показа баннера.
 * Ответ:
 *  { ok:true, status:'pending'|'approved'|'declined', amount:number }
 */

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) {
    return NextResponse.json({ ok: false, error: 'no id' }, { status: 400 });
  }
  const dep = await getDeposit(id);
  if (!dep) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    status: dep.status,
    amount: dep.amount,
  });
}