import { NextRequest, NextResponse } from 'next/server';
import { verify } from '@/lib/sign';
import { getDeposit, markDeposit } from '@/lib/deposits';

export const dynamic = 'force-dynamic';

/**
 * GET /api/deposit/decline?id=...&k=...
 * Обрабатывает клик администратора по кнопке "Отклонить"
 */
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

  markDeposit(id, 'declined');
  return NextResponse.json({ ok: true });
}