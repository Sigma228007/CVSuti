import { NextRequest, NextResponse } from 'next/server';
import bot from '@/lib/bot';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const update = JSON.parse(body);
    
    console.log('Webhook received:', update.update_id);
    
    await bot.handleUpdate(update);
    
    return NextResponse.json({ ok: true, processed: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';