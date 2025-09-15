import { NextRequest, NextResponse } from 'next/server';
import { getDeposit } from '@/lib/deposits';

export const dynamic = 'force-dynamic';

/**
 * GET /api/deposit/pending?id=...
 * Возвращает текущий статус заявки (для периодической проверки на фронте)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || '';

  if (!id) return NextResponse.json({ ok: false, error: 'no id' }, { status: 400 });

  const dep = getDeposit(id);
  if (!dep) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

  return NextResponse.json({ ok: true, id: dep.id, status: dep.status });
}