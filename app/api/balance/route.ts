import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getBalance } from '@/lib/store';

type TgUser = { id: number };

function verifyInitDataString(initData: string, botToken: string): { ok: boolean; user?: TgUser } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash') || '';
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const myHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (myHash !== hash) return { ok: false };

    const userStr = params.get('user');
    if (!userStr) return { ok: false };
    const user = JSON.parse(userStr) as TgUser;

    return { ok: true, user };
  } catch {
    return { ok: false };
  }
}

export async function GET(req: NextRequest) {
  const botToken = process.env.BOT_TOKEN || '';
  if (!botToken) {
    return NextResponse.json({ ok: false, error: 'BOT_TOKEN missing' }, { status: 500 });
  }

  // НОВОЕ: берём initData из заголовка, как делает твой фронт
  const initData =
    req.headers.get('x-init-data') ||
    req.nextUrl.searchParams.get('initData') ||
    '';

  if (!initData) {
    return NextResponse.json({ ok: false, error: 'no initData' }, { status: 401 });
  }

  const v = verifyInitDataString(initData, botToken);
  if (!v.ok || !v.user) {
    return NextResponse.json({ ok: false, error: 'bad initData' }, { status: 401 });
  }

  const bal = await getBalance(v.user.id);
  return NextResponse.json({ ok: true, balance: bal });
}