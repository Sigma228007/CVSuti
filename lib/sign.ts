import crypto from "crypto";

// удобнее без конфликта индекс-сигнатуры:
export type TelegramInitParsed = Record<string, string> & {
  user?: any;
  hash?: string;
};

export function parseInitData(initData: string): TelegramInitParsed {
  const sp = new URLSearchParams(initData);
  const obj: Record<string, string> = {};
  sp.forEach((v, k) => (obj[k] = v));
  if (obj.user) {
    try {
      // tg передает user как JSON-строку
      (obj as any).user = JSON.parse(obj.user);
    } catch {}
  }
  return obj as TelegramInitParsed;
}

// Валидация initData по алгоритму Telegram WebApp
export function verifyInitData(initData: string, botToken: string) {
  const data = parseInitData(initData);
  const { hash, ...rest } = data as any;
  if (!hash) return null;

  const checkArr = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${typeof rest[k] === "string" ? rest[k] : JSON.stringify(rest[k])}`);
  const dataCheckString = checkArr.join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const signature = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (signature !== hash) return null;
  return { ...rest, user: (rest as any).user };
}

/** Подпись admin ссылок (approve/decline) */
export function signAdmin(id: string, key: string) {
  return crypto.createHmac("sha256", key).update(id).digest("hex");
}

export function verifyAdminSig(id: string, sig: string, key: string) {
  return signAdmin(id, key) === sig;
}