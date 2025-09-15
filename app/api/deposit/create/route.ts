import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createDeposit } from '@/lib/store';

export const runtime = 'nodejs';

type TgUser = { id: number };

function verify(initData: string, botToken: string): TgUser | null {
  try {
    const p = new URLSearchParams(initData);
    const hash = p.get('hash') || '';
    p.delete('hash');
    const dataCheckString = Array.from(p.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const my = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (my !== hash) return null;
    const userStr = p.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr) as TgUser;
  } catch { return null; }
}

async function notifyAdmins(text: string) {
  const token = process.env.BOT_TOKEN;
  const chat = process.env.ADMIN_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ chat_id: chat, text }),
    });
  } catch {}
}

export async function POST(req: NextRequest) {
  const { initData, amount } = await req.json() as { initData?: string, amount?: number };

  if (!process.env.BOT_TOKEN) return NextResponse.json({ ok:false, error:'BOT_TOKEN missing' }, { status:500 });
  if (!initData) return NextResponse.json({ ok:false, error:'no initData' }, { status:401 });
  const u = verify(initData, process.env.BOT_TOKEN);
  if (!u) return NextResponse.json({ ok:false, error:'bad initData' }, { status:401 });

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return NextResponse.json({ ok:false, error:'bad amount' }, { status:400 });

  const rec = createDeposit(u.id, Math.floor(amt));
  await notifyAdmins(`💳 Новый запрос на пополнение\nID: ${rec.id}\nUser: ${u.id}\nСумма: ${rec.amount}₽`);

  return NextResponse.json({ ok:true, request: rec });
}