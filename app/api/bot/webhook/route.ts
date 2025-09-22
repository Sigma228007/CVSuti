import { NextRequest, NextResponse } from 'next/server';
import bot from '@/lib/bot';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const update = JSON.parse(body);
    
    await bot.handleUpdate(update);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';