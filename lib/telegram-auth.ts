import crypto from 'crypto';

export function verifyTelegramWebAppData(initData: string): boolean {
  try {
    // Для разработки - всегда возвращаем true
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: skipping Telegram verification');
      return true;
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash || !process.env.BOT_TOKEN) {
      return false;
    }

    const dataToCheck: string[] = [];
    urlParams.forEach((value, key) => {
      if (key !== 'hash') {
        dataToCheck.push(`${key}=${value}`);
      }
    });

    dataToCheck.sort();
    const dataCheckString = dataToCheck.join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN)
      .digest();

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

export function parseTelegramUserData(initData: string) {
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    
    if (!userStr) {
      return null;
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
    console.error('Parse user data error:', error);
    return null;
  }
}