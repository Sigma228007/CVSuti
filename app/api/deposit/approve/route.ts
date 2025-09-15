import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { setDepositStatus } from '@/lib/store';

export const runtime = 'nodejs';

type TgUser = { id: number };

function verify(initData: string, botToken: string): TgUser | null {
  try {
    const p = new URLSearchParams(initData);
    const hash = p.get('hash') || '';
    p.delete('hash');
    const str = Array.from(p.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
    const key = crypto.createHmac('sha256','WebAppData').update(botToken).digest();
    const my = crypto.createHmac('sha256', key).update(str).digest('hex');
    if (my !== hash) return null;
    const userStr = p.get('user'); if (!userStr) return null;
    return JSON.parse(userStr) as TgUser;
  } catch { return null; }
}

function isAdmin(id: number): boolean {
  const ids = (process.env.ADMIN_IDS ?? '').split(',').map(s=>Number(s.trim())).filter(Boolean);
  return ids.includes(id);
}

export async function POST(req: NextRequest) {
  const { initData, requestId, action } = await req.json() as { initData?: string, requestId?: string, action?: 'approve'|'decline' };

  if (!process.env.BOT_TOKEN) return NextResponse.json({ ok:false, error:'BOT_TOKEN missing' }, { status:500 });
  if (!initData) return NextResponse.json({ ok:false, error:'no initData' }, { status:401 });

  const u = verify(initData, process.env.BOT_TOKEN);
  if (!u || !isAdmin(u.id)) return NextResponse.json({ ok:false, error:'forbidden' }, { status:403 });

  if (!requestId || (action !== 'approve' && action !== 'decline')) {
    return NextResponse.json({ ok:false, error:'bad payload' }, { status:400 });
  }

  const updated = setDepositStatus(requestId, action === 'approve' ? 'approved' : 'declined');
  if (!updated) return NextResponse.json({ ok:false, error:'not found' }, { status:404 });

  return NextResponse.json({ ok:true, updated });
}