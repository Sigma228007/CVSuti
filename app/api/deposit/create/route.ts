import { NextRequest, NextResponse } from 'next/server';
import { createDeposit } from '@/lib/deposits';
import { notifyDepositAdmin } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/**
 * POST /api/deposit/create
 * body: { userId: number, amount: number }
 * создаёт заявку и шлёт уведомление администраторам
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, amount } = await req.json() as { userId: number; amount: number };
    if (!userId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'bad params' }, { status: 400 });
    }

    const dep = createDeposit(userId, Math.floor(amount));

    // отправка уведомления админу с кнопками
    await notifyDepositAdmin(dep);

    return NextResponse.json({ ok: true, depId: dep.id });
  } catch (e) {
    console.error('deposit/create error', e);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}