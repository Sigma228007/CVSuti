import crypto from "crypto";

/** Что мы парсим из initData Telegram WebApp */
export type TelegramInitParsed = {
  [k: string]: string | undefined; // <-- тут исправлено
  user?: any;
  hash?: string;
  signature?: string;
};

/** Разбор initData-строки из Telegram WebApp */
export function parseInitData(initData: string): TelegramInitParsed {
  const sp = new URLSearchParams(initData || "");
  const out: Record<string, string> = {};
  sp.forEach((v, k) => (out[k] = v));
  if (out.user) {
    try {
      (out as any).user = JSON.parse(out.user);
    } catch {
      /* ignore */
    }
  }
  return out as TelegramInitParsed;
}

/** Проверка initData (документация Telegram) */
export function verifyInitData(initData: string, botToken: string) {
  if (!initData || !botToken) return null;

  const data = parseInitData(initData);
  const received = (data.hash || data.signature || "").toLowerCase();
  if (!received) return null;

  const entries = Object.entries(data)
    .filter(([k]) => k !== "hash" && k !== "signature")
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .sort()
    .join("\n");

  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const expected = crypto.createHmac("sha256", secret).update(entries).digest("hex");

  const ok =
    expected.length === received.length &&
    crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));

  if (!ok) return null;
  return { ...data, user: (data as any).user };
}

/** Подпись payload для админских ссылок */
export function signAdminPayload(
  dep: { id: string; userId: number; amount: number },
  key: string
) {
  const payload = `${dep.id}|${dep.userId}|${dep.amount}`;
  return crypto.createHmac("sha256", key || "").update(payload).digest("hex");
}

/** Проверка параметров из админской ссылки approve/decline */
export function verifyAdminLink(query: {
  id?: string;
  user?: string | number;
  amount?: string | number;
  sig?: string;
}) {
  const id = String(query.id || "");
  const userId = Number(query.user);
  const amount = Number(query.amount);
  const sig = String(query.sig || "");

  if (!id || !userId || !amount || !sig) return { ok: false as const };

  const key = process.env.ADMIN_SIGN_KEY || "";
  const payload = `${id}|${userId}|${amount}`;
  const expected = crypto.createHmac("sha256", key).update(payload).digest("hex");

  const ok =
    expected.length === sig.length &&
    crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));

  if (!ok) return { ok: false as const };
  return { ok: true as const, id, userId, amount };
}