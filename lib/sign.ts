import crypto from 'crypto';

/** Внутренний тип распарсенного initData из Telegram WebApp */
export type TelegramInitParsed = {
  [k: string]: string;
  user?: any;
  hash: string;
};

/** Разбор initData-строки из Telegram WebApp */
export function parseInitData(initData: string): TelegramInitParsed {
  const sp = new URLSearchParams(initData);
  const obj: Record<string, string> = {};
  sp.forEach((v, k) => (obj[k] = v));

  // Попробуем распарсить user (если есть)
  if (obj.user) {
    try {
      obj.user = JSON.parse(obj.user);
    } catch {
      // игнор
    }
  }
  return obj as TelegramInitParsed;
}

/** Проверка initData по алгоритму Telegram (см. оф. доки) */
export function verifyInitData(initData: string, botToken: string) {
  const data = parseInitData(initData);
  const { hash, ...rest } = data as any;
  if (!hash) return null;

  // data_check_string
  const checkArr = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${typeof rest[k] === 'string' ? rest[k] : JSON.stringify(rest[k])}`);
  const dataCheckString = checkArr.join('\n');

  // secret = HMAC_SHA256("WebAppData", botToken)
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const signature = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (signature !== hash) return null;
  return { ...rest, user: (rest as any).user };
}

/** Подпись/проверка админ-коллбеков (approve/decline) */
export function signAdmin(id: string, key: string) {
  return crypto.createHmac('sha256', key).update(id).digest('hex');
}

export function verifyAdminSig(id: string, sig: string, key: string) {
  return signAdmin(id, key) === sig;
}