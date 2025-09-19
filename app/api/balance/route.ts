import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getBalance } from '@/lib/store';

type TgUser = { id: number };

function verifyInitDataString(initData: string, botToken: string): { ok: boolean; user?: TgUser } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash') || '';
    params.delete('hash');
    const s = Array.from(params.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
    const k = crypto.createHmac('sha256','WebAppData').update(botToken).digest();
    const my = crypto.createHmac('sha256', k).update(s).digest('hex');
    if (my !== hash) return { ok:false };
    const u = params.get('user'); if (!u) return { ok:false };
    return { ok:true, user: JSON.parse(u) as TgUser };
  } catch { return { ok:false } }
}

export async function GET(req: NextRequest) {
  const botToken = process.env.BOT_TOKEN || '';
  if (!botToken) return NextResponse.json({ ok:false, error:'BOT_TOKEN missing' }, { status:500 });

  const initHeader = req.headers.get('x-init-data') || '';
  const initQuery  = req.nextUrl.searchParams.get('initData') || '';
  const initData = initHeader || initQuery;

  if (!initData) return NextResponse.json({ ok:false, error:'no initData' }, { status:401 });

  const v = verifyInitDataString(initData, botToken);
  if (!v.ok || !v.user) return NextResponse.json({ ok:false, error:'bad initData' }, { status:401 });

  const bal = await getBalance(v.user.id);
  return NextResponse.json({ ok:true, balance: bal });
}