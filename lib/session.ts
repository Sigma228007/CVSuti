import { NextRequest } from "next/server";

/** Считать uid из куки (sync, удобно в route handlers) */
export function readUidFromCookies(req: NextRequest): number | null {
  const raw = req.cookies.get("uid")?.value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Проверка «это админ?» по списку ID из ENV:
 *  - ADMIN_IDS = "123,456"
 *  - (опционально) ADMIN_CHAT_ID = "123"
 */
export function isAdmin(uid: number | null): boolean {
  if (!uid) return false;

  const poolRaw =
    process.env.ADMIN_IDS ||
    process.env.ADMIN_CHAT_ID ||
    "";

  const admins = poolRaw
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n));

  return admins.length > 0 && admins.includes(uid);
}

/** Эвристика: похоже ли, что запрос пришёл из Telegram? */
export function isTelegramLike(req: NextRequest): boolean {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const ref = (req.headers.get("referer") || "").toLowerCase();
  return (
    ua.includes("telegram") ||
    ua.includes("tginternal") ||
    ref.includes("t.me") ||
    ref.includes("telegram.org")
  );
}

/** Алиас для совместимости со старыми импортами */
export const isProbablyTelegram = isTelegramLike;