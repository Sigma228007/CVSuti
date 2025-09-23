import { NextResponse } from 'next/server';
import { setWebhook } from '@/lib/bot';

export async function GET() {
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_BASE_URL) {
    return NextResponse.json({ 
      success: false, 
      message: 'Webhook setup skipped during build' 
    });
  }

  try {
    await setWebhook();
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook set successfully',
      environment: process.env.NODE_ENV 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';