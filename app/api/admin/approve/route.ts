import { NextRequest, NextResponse } from 'next/server';
import { verify } from '@/lib/sign';
import { getDeposit, markDeposit } from '@/lib/deposits';
import { getBalance, setBalance } from '@/lib/store'; // это у тебя уже есть

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || '';
  const k = searchParams.get('k') || '';

  if (!id || !verify(id, k)) {
    return NextResponse.json({ ok: false, error: 'bad signature' }, { status: 403 });
  }

  const dep = getDeposit(id);
  if (!dep) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  if (dep.status !== 'pending') {
    return NextResponse.json({ ok: false, error: 'already processed', status: dep.status }, { status: 400 });
  }

  markDeposit(id, 'approved');

  const before = getBalance(dep.userId);
  const after = before + dep.amount;
  setBalance(dep.userId, after);

  // можно вернуть простую HTML-страницу
  return NextResponse.json({ ok: true, applied: dep.amount, balance: after });
}