import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData } from '@/lib/sign';
import { getBalance, upsertUser } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    const botToken = process.env.BOT_TOKEN!;
    const parsed = verifyInitData(initData, botToken);
    if (!parsed || !parsed.user?.id) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const uid = Number(parsed.user.id);
    await upsertUser(uid, { user: parsed.user });

    const balance = await getBalance(uid);
    return NextResponse.json({ ok: true, user: parsed.user, balance });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}