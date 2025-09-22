import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    
    console.log('Received initData:', initData);

    if (!initData) {
      return NextResponse.json(
        { error: 'initData is required' },
        { status: 400 }
      );
    }

    // Для разработки - принимаем любой initData
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: accepting any initData');
      
      // Парсим данные пользователя из initData
      const urlParams = new URLSearchParams(initData);
      const userStr = urlParams.get('user');
      let userData = { id: 123456789, first_name: 'Test User' };
      
      if (userStr) {
        try {
          userData = JSON.parse(decodeURIComponent(userStr));
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }

      return NextResponse.json({ 
        success: true, 
        user: userData,
        message: 'Development authentication successful'
      });
    }

    // Здесь будет реальная проверка для production
    return NextResponse.json({ 
      success: true, 
      user: { id: 123456789, first_name: 'Test' },
      message: 'Authentication successful'
    });
    
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Добавляем обработку OPTIONS для CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// Добавляем обработку GET запросов с ошибкой
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST instead.' },
    { status: 405 }
  );
}