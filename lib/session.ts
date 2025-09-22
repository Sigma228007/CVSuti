import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";

/**
 * Helpers to read/write uid cookie and detect "probably Telegram".
 *
 * Cookie name: 'uid' (HttpOnly)
 */

export const UID_COOKIE = "uid";
export const UID_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function readUidFromCookies(req: NextRequest): number | null {
  try {
    const c = req.cookies.get(UID_COOKIE);
    if (!c || !c.value) return null;
    const n = Number(c.value);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Try to set uid cookie on a NextResponse instance */
export function writeUidCookie(res: NextResponse, uid: number) {
  try {
    if (res?.cookies && typeof res.cookies.set === "function") {
      res.cookies.set({
        name: UID_COOKIE,
        value: String(uid),
        httpOnly: true,
        path: "/",
        maxAge: UID_COOKIE_MAX_AGE,
        sameSite: "lax",
      });
      return;
    }
    // fallback: set header
    const header = `${UID_COOKIE}=${uid}; Path=/; HttpOnly; Max-Age=${UID_COOKIE_MAX_AGE}; SameSite=Lax`;
    const prev = res.headers.get("Set-Cookie");
    res.headers.set("Set-Cookie", prev ? `${prev}, ${header}` : header);
  } catch {
    // ignore silently
  }
}

/** Clear uid cookie from a NextResponse */
export function clearUidCookieFromResponse(res: NextResponse) {
  try {
    if (res?.cookies && typeof res.cookies.delete === "function") {
      // NOTE: cookies.delete expects a single parameter (cookie name) in current Next types.
      // Provide just the name to avoid TS signature errors.
      res.cookies.delete(UID_COOKIE);
      return;
    }
    // fallback: set empty cookie with Max-Age=0
    const header = `${UID_COOKIE}=; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    const prev = res.headers.get("Set-Cookie");
    res.headers.set("Set-Cookie", prev ? `${prev}, ${header}` : header);
  } catch {
    // ignore
  }
}

/** Build a Set-Cookie header string for manual use */
export function uidCookieHeader(uid: number) {
  return `${UID_COOKIE}=${uid}; Path=/; HttpOnly; Max-Age=${UID_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Heuristic: check if request "probably" comes from Telegram (UA or special headers) */
export function isProbablyTelegram(req: NextRequest): boolean {
  try {
    const ua = (req.headers.get("user-agent") || "").toLowerCase();
    if (ua.includes("telegram")) return true;
    // Telegram WebApp sometimes has special header
    if (req.headers.get("x-telegram-bot-api-user-id")) return true;
    // query params may include tgWebAppData or initData on initial request
    const url = new URL(req.url);
    if (url.searchParams.get("tgWebAppData") || url.searchParams.get("initData")) return true;
    return false;
  } catch {
    return false;
  }
}

/** Admin check helper — ADMIN_IDS from env (comma-separated) */
export function isAdmin(uid: number | null | undefined): boolean {
  if (!uid) return false;
  const s = process.env.ADMIN_IDS || process.env.ADMIN_ID || "";
  if (!s) return false;
  try {
    const list = s.split(",").map((x) => Number(x.trim())).filter(Boolean);
    return list.includes(Number(uid));
  } catch {
    return false;
  }
}

/**
 * Try to extract `user` object from Telegram WebApp initData string.
 * - If `initData` is a data_check_string (URLSearchParams) — parse user param.
 * - If it's JSON-like — attempt JSON.parse.
 *
 * Returns { ok: true, id, userObject (if present), verified: boolean } or { ok: false }.
 *
 * NOTE: verification is optional — we attempt `verifyInitData` if botToken provided.
 */
export function extractUserFromInitData(initData: string | undefined, botToken?: string) {
  if (!initData) return { ok: false as const };

  try {
    // If it looks like URLSearchParams (contains '=')
    if (initData.includes("=") && initData.includes("&")) {
      const params = new URLSearchParams(initData);
      const userStr = params.get("user") || params.get("user_json") || null;
      let verified = false;

      if (botToken) {
        try {
          const v = verifyInitData(initData, botToken);
          if (v.ok) {
            return { ok: true as const, id: v.user.id, user: v.user, verified: true as const };
          }
        } catch {
          // ignore verification errors
        }
      }

      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user && typeof user.id === "number") {
            return { ok: true as const, id: user.id, user, verified: verified as boolean };
          }
        } catch {
          // ignore
        }
      }

      return { ok: false as const };
    }

    // If JSON-ish
    try {
      const maybe = JSON.parse(initData);
      if (maybe && typeof maybe === "object" && typeof maybe.id === "number") {
        return { ok: true as const, id: maybe.id, user: maybe, verified: false as const };
      }
    } catch {}

    return { ok: false as const };
  } catch {
    return { ok: false as const };
  }
}