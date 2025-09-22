import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    
    if (!initData) {
      return NextResponse.json(
        { error: 'initData is required' },
        { status: 400 }
      );
    }

    // Проверяем данные Telegram Web App
    const isValid = verifyTelegramWebAppData(initData);
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid Telegram authentication' },
        { status: 401 }
      );
    }

    // Извлекаем данные пользователя из initData
    const userData = parseInitData(initData);
    
    // Создаем ответ с пользовательскими данными
    return NextResponse.json({ 
      success: true, 
      user: userData,
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

function verifyTelegramWebAppData(initData: string): boolean {
  try {
    // Для разработки - всегда возвращаем true
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: skipping Telegram verification');
      return true;
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      return false;
    }

    // Собираем данные для проверки
    const dataToCheck: string[] = [];
    urlParams.forEach((value, key) => {
      if (key !== 'hash') {
        dataToCheck.push(`${key}=${value}`);
      }
    });

    // Сортируем и объединяем
    dataToCheck.sort();
    const dataCheckString = dataToCheck.join('\n');

    // Создаем секретный ключ
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN || '')
      .digest();

    // Вычисляем хэш
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;

  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}

function parseInitData(initData: string): any {
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    
    if (!userStr) {
      throw new Error('User data not found in initData');
    }

    const userData = JSON.parse(userStr);
    
    return {
      id: userData.id,
      first_name: userData.first_name,
      last_name: userData.last_name || '',
      username: userData.username || '',
      language_code: userData.language_code || '',
      is_premium: userData.is_premium || false,
      allows_write_to_pm: userData.allows_write_to_pm || false
    };

  } catch (error) {
    console.error('Parse initData error:', error);
    throw new Error('Failed to parse user data');
  }
}

// Добавляем обработку OPTIONS для CORS
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}