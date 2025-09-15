import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData } from '@/lib/sign';
import { getPendingForUser } from '@/lib/deposits';

export async function GET(req: NextRequest) {
  try {
    const initData = req.nextUrl.searchParams.get('initData') || '';
    const botToken = process.env.BOT_TOKEN!;
    const parsed = verifyInitData(initData, botToken);
    if (!parsed || !parsed.user?.id) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const list = getPendingForUser(Number(parsed.user.id));
    return NextResponse.json({ ok: true, list });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}