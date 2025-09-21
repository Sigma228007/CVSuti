import { NextRequest, NextResponse } from "next/server";

/** -------- эвристика: это похоже на Telegram -------- */
export function isTelegramLike(req: NextRequest): boolean {
  const h = req.headers;
  if ((h.get("x-telegram-like") || "") === "1") return true; // <- от клиента
  const ua = (h.get("user-agent") || "").toLowerCase();
  const ref = (h.get("referer") || "").toLowerCase();
  return (
    ua.includes("telegram") ||
    ua.includes("tgmini") ||
    ua.includes("tginternal") ||
    ref.includes("t.me") ||
    ref.includes("telegram.org")
  );
}
export const isProbablyTelegram = isTelegramLike;

/** -------- кука с uid -------- */
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

/** -------- админы -------- */
export function isAdmin(uid: number | null): boolean {
  if (!uid) return false;
  const pool =
    (process.env.ADMIN_IDS || process.env.ADMIN_CHAT_ID || "")
      .split(",")
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n));
  return pool.includes(uid);
}

/** -------- вытащить initData / uid из разных мест -------- */
export function extractInitDataSources(req: NextRequest) {
  const h = req.headers;
  return {
    headerInitData: h.get("x-telegram-init-data") || null,
  };
}

/** -------- мягкий "гостевой" uid для телеграм-вебвью, когда нет initData -------- */
export function makeGuestUid(req: NextRequest): number {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "0";
  const ua = req.headers.get("user-agent") || "";
  const seed = `${ip}|${ua}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) + 10_000_000; // диапазон гостей, не пересекается с реальными uid
}