import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSig } from '@/lib/sign';
import { getDeposit, markDeposit } from '@/lib/deposits';
import { addBalance, getBalance, setBalance } from '@/lib/store';
import { notifyUserDepositApproved } from '@/lib/notify';

function credit(userId: number, amount: number) {
  // если есть addBalance — используем, иначе fallback
  if (typeof addBalance === 'function') {
    addBalance(userId, amount);
  } else {
    const current = getBalance(userId);
    setBalance(userId, current + amount);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { depId, sig } = (await req.json()) as { depId: string; sig: string };
    if (!depId || !sig) {
      return NextResponse.json({ ok: false, error: 'bad params' }, { status: 400 });
    }

    const key = process.env.ADMIN_SIGN_KEY!;
    if (!verifyAdminSig(depId, sig, key)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const dep = getDeposit(depId);
    if (!dep) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    if (dep.status !== 'pending') {
      return NextResponse.json({ ok: false, error: 'already processed' }, { status: 409 });
    }

    markDeposit(depId, 'approved');
    credit(dep.userId, dep.amount);
    await notifyUserDepositApproved(dep);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}