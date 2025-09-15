import crypto from "crypto";

export type TelegramInitParsed = {
  [k: string]: string | undefined; // <-- допускаем undefined
  user?: any;
  hash?: string;
  signature?: string;
};
/** Парсим строку initData из Telegram WebApp */
export function parseInitData(initData: string): TelegramInitParsed {
  const sp = new URLSearchParams(initData);
  const obj: Record<string, string> = {};
  sp.forEach((v, k) => (obj[k] = v));

  const out: TelegramInitParsed = { ...obj };
  if (obj.user) {
    try { out.user = JSON.parse(obj.user); } catch {}
  }
  return out;
}

/** Проверяем initData по алгоритму Telegram */
export function verifyInitData(initData: string, botToken: string) {
  if (!initData || !botToken) return null;

  const data = parseInitData(initData);
  const { hash, signature, ...rest } = data as any;

  // data_check_string: все пары кроме hash/signature, сортируем по ключу
  const check = Object.keys(rest)
    .sort()
    .map(k => `${k}=${typeof (rest as any)[k] === "string" ? (rest as any)[k] : JSON.stringify((rest as any)[k])}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const sign   = crypto.createHmac("sha256", secret).update(check).digest("hex");

  const given = (hash || signature || "").toLowerCase();
  if (!given || given !== sign) return null;

  return { ok: true as const, user: (data as any).user };
}

/** Подпись/проверка админ-ссылок (approve/decline) */
export function signAdminPayload(payload: object, key: string) {
  return crypto.createHmac("sha256", key).update(JSON.stringify(payload)).digest("hex");
}

export function verifyAdminLink(query: URLSearchParams, key: string) {
  const id     = query.get("id") ?? "";
  const user   = Number(query.get("user") ?? "0");
  const amount = Number(query.get("amount") ?? "0");
  const sig    = query.get("sig") ?? "";

  if (!id || !user || !amount || !sig) return null;

  const expect = signAdminPayload({ id, userId: user, amount }, key);
  if (expect !== sig) return null;

  return { id, userId: user, amount };
}