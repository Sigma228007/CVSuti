import crypto from "crypto";

/** ---- Telegram initData ---- */

export type TelegramInitParsed = {
  user?: string;
  hash?: string;
} & Record<string, string | undefined>;

export function parseInitData(initData: string): TelegramInitParsed {
  const sp = new URLSearchParams(initData || "");
  const obj: Record<string, string | undefined> = {};
  sp.forEach((v, k) => { obj[k] = v; });
  if (obj.user) {
    try { obj.user = JSON.parse(obj.user as string); } catch { /* ignore */ }
  }
  return obj as any;
}

export function verifyInitData(initData: string, botToken: string) {
  const data = parseInitData(initData);
  const { hash, ...rest } = data as any;
  if (!hash) return null;

  const checkArr = Object.keys(rest)
    .sort()
    .map(k => `${k}=${typeof (rest as any)[k] === "string" ? (rest as any)[k] : JSON.stringify((rest as any)[k])}`);
  const dataCheckString = checkArr.join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const signature = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (signature !== hash) return null;

  const user = (rest as any).user;
  try {
    const u = typeof user === "string" ? JSON.parse(user) : user;
    return u && typeof u.id === "number" ? { id: u.id } : null;
  } catch { return null; }
}

/** ---- Admin HMAC for approve/decline links (stateless) ---- */

export type AdminLinkPayload = { id: string; userId: number; amount: number };

function buildDataString(p: AdminLinkPayload) {
  return `${p.id}:${p.userId}:${p.amount}`;
}

export function signAdminPayload(p: AdminLinkPayload, key: string) {
  return crypto.createHmac("sha256", key).update(buildDataString(p)).digest("hex");
}

export function verifyAdminLink(q: {
  id?: string | null; user?: string | null; amount?: string | null; sig?: string | null;
}, key: string): AdminLinkPayload | null {
  const id = q.id ?? "";
  const user = q.user ?? "";
  const amount = q.amount ?? "";
  const sig = q.sig ?? "";

  if (!id || !user || !amount || !sig) return null;

  const payload = { id: String(id), userId: Number(user), amount: Number(amount) };
  if (!Number.isFinite(payload.userId) || !Number.isFinite(payload.amount)) return null;

  const calc = signAdminPayload(payload, key);
  if (calc !== sig) return null;
  return payload;
}