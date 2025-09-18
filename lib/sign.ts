import crypto from "crypto";

/* =======================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ======================= */

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/* ==========================================================
   1) Подпись/проверка токенов для админ-кнопок (Approve/Decline)
   ========================================================== */

export function signAdminPayload(payload: Record<string, unknown>): string {
  const secret =
    process.env.ADMIN_SIGN_SECRET ||
    process.env.FK_SECRET_2 ||
    process.env.FK_SECRET_1 ||
    "";

  if (!secret) {
    throw new Error(
      "Admin sign secret is not set (ADMIN_SIGN_SECRET / FK_SECRET_2 / FK_SECRET_1)."
    );
  }

  const data = JSON.stringify(payload);
  const header = b64url(data);
  const sig = crypto.createHmac("sha256", secret).update(header).digest();
  const token = `${header}.${b64url(sig)}`;
  return token;
}

export function verifyAdminToken(
  token: string
): { ok: true; payload: any } | { ok: false } {
  try {
    const secret =
      process.env.ADMIN_SIGN_SECRET ||
      process.env.FK_SECRET_2 ||
      process.env.FK_SECRET_1 ||
      "";
    if (!secret) return { ok: false };

    const [header, signature] = token.split(".");
    if (!header || !signature) return { ok: false };

    const expected = b64url(
      crypto.createHmac("sha256", secret).update(header).digest()
    );
    if (signature !== expected) return { ok: false };

    const json = Buffer.from(
      header.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
    const payload = JSON.parse(json);
    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}

/* ==========================================================
   2) verifyInitData — проверка Telegram WebApp initData
      Используется в /api/balance и /api/fkwallet/invoice
   ========================================================== */

export type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

export function verifyInitData(
  initData: string,
  botToken: string
): { ok: true; user: TgUser } | { ok: false } {
  try {
    if (!initData || !botToken) return { ok: false };

    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    if (!hash) return { ok: false };

    // data_check_string по правилам Telegram
    const entries = Array.from(params.entries())
      .filter(([key]) => key !== "hash")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    // секрет — HMAC_SHA256(WebAppData, bot_token)
    const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const myHash = crypto.createHmac("sha256", secret).update(entries).digest("hex");

    if (myHash !== hash) return { ok: false };

    const userStr = params.get("user");
    if (!userStr) return { ok: false };

    const user = JSON.parse(userStr) as TgUser;
    if (!user || typeof user.id !== "number") return { ok: false };

    // (необязательно) можно проверить срок годности initData по auth_date
    // const authDate = Number(params.get("auth_date") || "0");
    // if (!authDate || Date.now() / 1000 - authDate > 3600) return { ok: false };

    return { ok: true, user };
  } catch {
    return { ok: false };
  }
}