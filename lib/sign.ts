import crypto from "crypto";

export type TelegramInitParsed = {
  [k: string]: string | undefined; // теперь все ключи могут быть undefined
  user?: string;
  hash?: string;
};

export function parseInitData(initData: string): TelegramInitParsed {
  const params = new URLSearchParams(initData);
  const obj: Record<string, string> = {};
  // собираем все ключи/значения один-в-один как прислал Telegram
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

/** Валидация как в документации Telegram Web Apps */
export function verifyInitData(initData: string, botToken: string) {
  try {
    const data = parseInitData(initData);
    const { hash, ...rest } = data as any;

    if (!hash) return null;

    // data_check_string
    const lines = Object.keys(rest)
      .sort()
      .map(k => `${k}=${typeof rest[k] === "string" ? rest[k] : JSON.stringify(rest[k])}`)
      .join("\n");

    const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const signature = crypto.createHmac("sha256", secret).update(lines).digest("hex");

    if (signature !== hash) return null;

    // user = JSON string → распарсим
    const user = rest.user ? JSON.parse(rest.user) : undefined;
    return { ...rest, user };
  } catch {
    return null;
  }
}

/** Подпись/проверка ссылок для админ-кнопок в Telegram */
export function signAdmin(id: string, key: string) {
  return crypto.createHmac("sha256", key).update(id).digest("hex");
}
export function verifyAdminSig(id: string, sig: string, key: string) {
  return signAdmin(id, key) === sig;
}