import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData } from '@/lib/sign';
import { createDeposit } from '@/lib/deposits';
import { notifyNewDeposit } from '@/lib/notify'; // у тебя уже есть notify.ts

export async function POST(req: NextRequest) {
  try {
    const { initData, amount } = (await req.json()) as {
      initData: string;
      amount: number;
    };

    if (!initData || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'bad params' }, { status: 400 });
    }

    const botToken = process.env.BOT_TOKEN!;
    const parsed = verifyInitData(initData, botToken);
    if (!parsed || !parsed.user?.id) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const dep = createDeposit(Number(parsed.user.id), Math.floor(amount));
    await notifyNewDeposit(dep); // сообщение админам

    return NextResponse.json({ ok: true, dep });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}