import { NextRequest, NextResponse } from 'next/server';
import { extractUserFromInitData, writeUidCookie } from '@/lib/session';
import { ensureUser, getBalance } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    
    if (!initData) {
      return NextResponse.json({ ok: false, error: 'initData required' });
    }

    // Извлекаем пользователя из initData
    const userResult = extractUserFromInitData(initData, process.env.BOT_TOKEN);
    
    if (!userResult.ok) {
      return NextResponse.json({ ok: false, error: 'Invalid initData' });
    }

    const { id: uid, user: userData } = userResult;

    // Создаем/обновляем пользователя в базе
    await ensureUser({
      id: uid,
      first_name: userData.first_name,
      username: userData.username
    });

    // Получаем баланс
    const balance = await getBalance(uid);

    const response = NextResponse.json({ 
      ok: true, 
      uid,
      balance,
      user: userData
    });

    // Устанавливаем cookie
    writeUidCookie(response, uid);

    return response;
    
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ ok: false, error: 'Server error' });
  }
}