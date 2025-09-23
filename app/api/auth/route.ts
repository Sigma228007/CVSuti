import { NextRequest, NextResponse } from 'next/server';
import { extractUserFromInitData, generateToken } from '@/lib/session';
import { ensureUser, getBalance } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    
    if (!initData) {
      return NextResponse.json({ 
        ok: false, 
        error: 'initData required'
      });
    }

    const userResult = extractUserFromInitData(initData, process.env.BOT_TOKEN);
    
    if (!userResult.ok || !userResult.verified) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Invalid or unverified initData' 
      });
    }

    const { id: uid, user: userData } = userResult;

    await ensureUser({
      id: uid,
      first_name: userData.first_name,
      username: userData.username
    });

    const balance = await getBalance(uid);
    const token = generateToken(uid);

    return NextResponse.json({ 
      ok: true, 
      uid,
      balance,
      user: userData,
      token // Отправляем токен клиенту
    });
    
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Server error during authentication' 
    });
  }
}