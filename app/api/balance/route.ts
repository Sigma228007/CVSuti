import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData } from '@/lib/sign';
import { getBalance } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const botToken = process.env.BOT_TOKEN || '';
    if (!botToken) return NextResponse.json({ ok: false, error: 'BOT_TOKEN missing' }, { status: 500 });

    const fromHeader = req.headers.get('x-init-data') || '';
    const fromQuery  = req.nextUrl.searchParams.get('tgWebAppData') || '';
    const initData   = fromHeader || fromQuery;
    if (!initData) return NextResponse.json({ ok: false, error: 'no initData' }, { status: 401 });

    const parsed = verifyInitData(initData, botToken); // { ok: true, user } | { ok: false }
    if (!parsed.ok || !parsed.user) return NextResponse.json({ ok: false, error: 'bad initData' }, { status: 401 });

    const balance = await getBalance(parsed.user.id);
    return NextResponse.json({ ok: true, balance });
  } catch {
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}