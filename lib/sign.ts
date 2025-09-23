import crypto from "crypto";

export type TgUser = { id: number; first_name?: string; username?: string };

/**
 * Проверка Telegram WebApp initData.
 * Возвращает { ok: true, user } либо { ok: false, error }.
 */
export function verifyInitData(
  initData: string,
  botToken: string
): { ok: true; user: TgUser } | { ok: false; error?: string } {
  try {
    if (!initData || !botToken) {
      return { ok: false, error: "Missing initData or botToken" };
    }

    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    params.delete("hash");

    if (!hash) {
      return { ok: false, error: "No hash in initData" };
    }

    // Формируем data_check_string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    // Секретный ключ: HMAC_SHA256("WebAppData", botToken)
    const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();

    // Хэш
    const myHash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

    if (myHash !== hash) {
      return { ok: false, error: "Hash mismatch" };
    }

    const userStr = params.get("user");
    if (!userStr) {
      return { ok: false, error: "No user data" };
    }

    const user = JSON.parse(decodeURIComponent(userStr)) as TgUser;
    
    if (!user || typeof user.id !== "number") {
      return { ok: false, error: "Invalid user data" };
    }

    return { ok: true, user };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/* ------------------------------------------------------------------
   Подпись/проверка «админ-ссылок» (approve/decline)
   Формат токена: <base64url(payload)>.<hex(hmac)>
------------------------------------------------------------------- */

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/** Подписать payload секретом (для генерации ссылки) */
export function signAdminPayload(payload: unknown, secret: string): string {
  const data = typeof payload === "string" ? payload : JSON.stringify(payload);
  const body = b64url(data);
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `${body}.${sig}`;
}

/**
 * Проверка токена админ-ссылки.
 * Возвращает { ok: true, payload } либо { ok: false }.
 */
export function verifyAdminLink(
  token: string,
  secret: string
): { ok: true; payload: any } | { ok: false } {
  try {
    if (!token || !secret) return { ok: false };
    const [body, sig] = token.split(".");
    if (!body || !sig) return { ok: false };

    const expect = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) {
      return { ok: false };
    }
    const json = fromB64url(body).toString("utf8");
    const payload = JSON.parse(json);
    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}