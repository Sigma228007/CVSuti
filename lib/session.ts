import { verifyInitData } from "@/lib/sign";

export const TOKEN_KEY = "auth_token";

// Генерируем простой JWT токен
export function generateToken(uid: number): string {
  const payload = {
    uid,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) // 30 дней
  };
  const base64Payload = btoa(JSON.stringify(payload));
  return `eyJ.${base64Payload}.signature`; // Упрощенный JWT
}

// Проверяем токен
export function verifyToken(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    
    return payload.uid;
  } catch {
    return null;
  }
}

// Получаем UID из запроса (из заголовка или токена)
export function getUidFromRequest(headers: Headers): number | null {
  // Пробуем из заголовка
  const authHeader = headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }
  
  // Пробуем из query параметра (для WebApp)
  const url = new URL(headers.get('referer') || '');
  const tokenFromUrl = url.searchParams.get('token');
  if (tokenFromUrl) {
    return verifyToken(tokenFromUrl);
  }
  
  return null;
}

// Для совместимости со старым кодом
export function readUidFromCookies(req: { headers: Headers }): number | null {
  return getUidFromRequest(req.headers);
}

export function extractUserFromInitData(initData: string, botToken?: string) {
  if (!initData) return { ok: false as const };

  try {
    let parsedData: any = null;
    
    if (initData.includes('=') && initData.includes('&')) {
      const params = new URLSearchParams(initData);
      const userStr = params.get('user') || params.get('user_json');
      if (userStr) {
        try {
          parsedData = JSON.parse(decodeURIComponent(userStr));
        } catch {}
      }
    }
    
    if (!parsedData) {
      try {
        parsedData = JSON.parse(initData);
      } catch {}
    }

    if (!parsedData && initData.includes('user=')) {
      const userMatch = initData.match(/user=([^&]*)/);
      if (userMatch && userMatch[1]) {
        try {
          parsedData = JSON.parse(decodeURIComponent(userMatch[1]));
        } catch {}
      }
    }

    if (!parsedData || !parsedData.id) return { ok: false };

    let verified = false;
    if (botToken) {
      try {
        const verification = verifyInitData(initData, botToken);
        verified = verification.ok;
      } catch {
        verified = false;
      }
    }

    return {
      ok: true as const,
      id: parsedData.id,
      user: parsedData,
      verified
    };
  } catch {
    return { ok: false as const };
  }
}

export function isAdmin(uid: number | null | undefined): boolean {
  if (!uid) return false;
  const adminIds = (process.env.ADMIN_IDS || "").split(",")
    .map(id => Number(id.trim()))
    .filter(id => id > 0);
  return adminIds.includes(uid);
}