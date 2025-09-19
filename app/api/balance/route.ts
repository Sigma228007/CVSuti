import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData } from '@/lib/sign';
import { getBalance } from '@/lib/store';

export async function GET(req: NextRequest) {
  const botToken = process.env.BOT_TOKEN || '';
  if (!botToken) {
    return NextResponse.json({ ok: false, error: 'BOT_TOKEN missing' }, { status: 500 });
  }

  // initData: сначала из заголовка, затем из query (на всякий)
  const initData =
    req.headers.get('x-init-data') ||
    req.nextUrl.searchParams.get('initData') ||
    req.nextUrl.searchParams.get('tgWebAppData') ||
    '';

  if (!initData) {
    return NextResponse.json({ ok: false, error: 'no initData' }, { status: 401 });
  }

  const v = verifyInitData(initData, botToken);
  if (!v.ok || !v.user) {
    return NextResponse.json({ ok: false, error: 'bad initData' }, { status: 401 });
  }

  const bal = await getBalance(v.user.id);
  return NextResponse.json({ ok: true, balance: bal });
}