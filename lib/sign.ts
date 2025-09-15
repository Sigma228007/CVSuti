import crypto from "crypto";

/** Разбор строки initData из Telegram WebApp */
export function parseInitData(initData: string): Record<string, any> {
  const sp = new URLSearchParams(initData || "");
  const obj: Record<string, any> = {};
  sp.forEach((v, k) => (obj[k] = v));
  if (obj.user) {
    try { obj.user = JSON.parse(obj.user as string); } catch {}
  }
  return obj;
}

/** Верификация initData по алгоритму Telegram */
export function verifyInitData(initData: string, botToken: string) {
  const data = parseInitData(initData);
  const { hash, ...rest } = data as any;
  if (!hash) return null;

  // 1) data_check_string
  const checkArr = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${typeof rest[k] === "string" ? rest[k] : JSON.stringify(rest[k])}`);
  const dataCheckString = checkArr.join("\n");

  // 2) secret = HMAC_SHA256("WebAppData", botToken)
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const signature = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (signature !== hash) return null;
  return { ...rest, user: (rest as any).user as { id: number } };
}

export type VerifiedInit = NonNullable<ReturnType<typeof verifyInitData>>;

/** Подпись/проверка админ-ссылок (approve/decline) */
export function signAdminPayload(payload: any, key: string) {
  const id = String(payload?.id ?? "");
  const signer = crypto.createHmac("sha256", key).update(id);
  return signer.digest("hex");
}
export function verifyAdminLink(sig: string, id: string, key: string) {
  if (!sig || !id || !key) return false;
  const right = signAdminPayload({ id }, key);
  // Тайминг-безопасное сравнение
  const a = Buffer.from(right, "utf8");
  const b = Buffer.from(sig, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}