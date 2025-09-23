import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    
    if (!initData) {
      return NextResponse.json({ ok: false, error: 'initData required' });
    }

    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    let userData = { id: 999217382, first_name: 'Saul' }; // дефолтные значения
    
    if (userStr) {
      try {
        userData = JSON.parse(decodeURIComponent(userStr));
      } catch (e) {}
    }

    return NextResponse.json({ 
      ok: true, 
      uid: userData.id,
      balance: 1000, // временно
      user: userData
    });
    
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Server error' });
  }
}