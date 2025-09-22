import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";

export const UID_COOKIE = "uid";
export const UID_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function readUidFromCookies(req: NextRequest): number | null {
  try {
    const c = req.cookies.get(UID_COOKIE);
    if (!c || !c.value) return null;
    const n = Number(c.value);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeUidCookie(res: NextResponse, uid: number) {
  try {
    res.cookies.set({
      name: UID_COOKIE,
      value: String(uid),
      httpOnly: true,
      path: "/",
      maxAge: UID_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } catch {}
}

export function clearUidCookieFromResponse(res: NextResponse) {
  try {
    res.cookies.delete(UID_COOKIE);
  } catch {}
}

export function isProbablyTelegram(req: NextRequest): boolean {
  try {
    const ua = (req.headers.get("user-agent") || "").toLowerCase();
    if (ua.includes("telegram")) return true;
    if (req.headers.get("x-telegram-bot-api-user-id")) return true;
    
    const url = new URL(req.url);
    return !!(
      url.searchParams.get("tgWebAppData") || 
      url.searchParams.get("initData") ||
      url.searchParams.get("tgWebAppStartParam")
    );
  } catch {
    return false;
  }
}

export function isAdmin(uid: number | null | undefined): boolean {
  if (!uid) return false;
  const adminIds = (process.env.ADMIN_IDS || "").split(",")
    .map(id => Number(id.trim()))
    .filter(id => id > 0);
  return adminIds.includes(uid);
}

export function extractUserFromInitData(initData: string, botToken?: string) {
  if (!initData) return { ok: false as const };

  try {
    // Пробуем разные форматы initData
    let parsedData: any = null;
    
    // 1. Пробуем как URLSearchParams
    if (initData.includes('=') && initData.includes('&')) {
      const params = new URLSearchParams(initData);
      const userStr = params.get('user') || params.get('user_json');
      if (userStr) {
        try {
          parsedData = JSON.parse(decodeURIComponent(userStr));
        } catch {}
      }
    }
    
    // 2. Пробуем как JSON строку
    if (!parsedData) {
      try {
        parsedData = JSON.parse(initData);
      } catch {}
    }

    // 3. Пробуем как raw data
    if (!parsedData && initData.includes('user=')) {
      const userMatch = initData.match(/user=([^&]*)/);
      if (userMatch && userMatch[1]) {
        try {
          parsedData = JSON.parse(decodeURIComponent(userMatch[1]));
        } catch {}
      }
    }

    if (!parsedData || !parsedData.id) return { ok: false };

    // Валидация подписи
    let verified = false;
    if (botToken) {
      try {
        const verification = verifyInitData(initData, botToken);
        verified = verification.ok;
      } catch {
        verified = false;
      }
    }

    return {
      ok: true as const,
      id: parsedData.id,
      user: parsedData,
      verified
    };
  } catch {
    return { ok: false as const };
  }
}