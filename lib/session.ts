import { NextRequest, NextResponse } from "next/server";

const UID_COOKIE = "uid";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 дней

/** Признаки, что запрос пришёл из Telegram WebApp */
export function isProbablyTelegram(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") || "";
  if (/Telegram/i.test(ua)) return true;

  const ref = req.headers.get("referer") || "";
  if (/t\.me|telegram\.org/i.test(ref)) return true;

  if (req.headers.has("x-telegram-init-data")) return true;
  if (req.headers.has("telegram-init-data")) return true;

  return false;
}

/** Считать uid из cookie (number | null) */
export function readUidFromCookies(req: NextRequest): number | null {
  const v = req.cookies.get(UID_COOKIE)?.value;
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Записать/обновить cookie uid */
export function writeUidCookie(res: NextResponse, uid: number) {
  res.cookies.set(UID_COOKIE, String(uid), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Достать initData из заголовков/URL (?initData= или ?tgWebAppData=) */
export function parseInitData(req: NextRequest): string | null {
  const h =
    req.headers.get("x-telegram-init-data") ||
    req.headers.get("telegram-init-data") ||
    req.headers.get("x-init-data");
  if (h) return h;

  const u = req.nextUrl;
  const q1 = u.searchParams.get("initData");
  if (q1) return q1;
  const q2 = u.searchParams.get("tgWebAppData");
  if (q2) return q2;

  return null;
}

/** Проверка админов по списку в .env (через запятую) */
export function isAdmin(uid: number | null | undefined): boolean {
  if (!uid || !Number.isFinite(uid)) return false;
  const src =
    process.env.ADMIN_IDS ||
    process.env.NEXT_PUBLIC_ADMIN_IDS || // если хочешь держать в public
    "";
  const ids = src
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.includes(uid as number);
}