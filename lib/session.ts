import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/** ---------- UA/Referer эвристика "похоже на Telegram" ---------- */
export function isTelegramLike(req: NextRequest): boolean {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const ref = (req.headers.get("referer") || "").toLowerCase();
  return (
    ua.includes("telegram") ||
    ua.includes("tgmini") ||
    ua.includes("tginternal") ||
    ref.includes("t.me") ||
    ref.includes("telegram.org")
  );
}
/** Алиас для старых импортов */
export const isProbablyTelegram = isTelegramLike;

/** ---------- UID в куках ---------- */
const UID_COOKIE = "uid";

export function readUidFromCookies(req: NextRequest): number | null {
  const raw = req.cookies.get(UID_COOKIE)?.value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function setUidCookie(res: NextResponse, uid: number) {
  const oneYear = 3600 * 24 * 365;
  res.cookies.set(UID_COOKIE, String(uid), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: oneYear,
  });
}

/** ---------- Админы ---------- */
export function isAdmin(uid: number | null): boolean {
  if (!uid) return false;
  const pool =
    (process.env.ADMIN_IDS || process.env.ADMIN_CHAT_ID || "")
      .split(",")
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n)) || [];
  return pool.includes(uid);
}

/** ---------- Вытащить initData / uid из всего, где возможно ---------- */
export function extractInitDataSources(req: NextRequest) {
  const h = req.headers;
  return {
    // 1) "официальный" заголовок с фронта
    headerInitData: h.get("x-telegram-init-data") || null,
    // 2) иногда прокидывают просто uid
    headerUid: h.get("x-telegram-user-id") || null,
    // 3) query (если страница открыта с tgWebAppData)
    queryInitData: req.nextUrl.searchParams.get("tgWebAppData") || null,
  };
}