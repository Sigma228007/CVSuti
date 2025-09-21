import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/store"; // у тебя уже есть redis() в lib/store.ts

const SESS_PREFIX = "sess:";
const SID_COOKIE = "sid";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

export type Session = {
  userId: number;
  createdAt: number;
  lastSeenAt: number;
};

function randId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function readSession(): Promise<Session | null> {
  const sid = cookies().get(SID_COOKIE)?.value || "";
  if (!sid) return null;
  const json = await redis().get(SESS_PREFIX + sid);
  if (!json) return null;
  try {
    const s = JSON.parse(json) as Session;
    return s;
  } catch {
    return null;
  }
}

export async function writeSession(resp: NextResponse, userId: number) {
  const sid = randId();
  const sess: Session = {
    userId,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  };
  await redis().set(SESS_PREFIX + sid, JSON.stringify(sess), "EX", MAX_AGE);
  resp.cookies.set(SID_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function requireSession(req: NextRequest) {
  const sid = req.cookies.get(SID_COOKIE)?.value || "";
  if (!sid) return null;
  const json = await redis().get(SESS_PREFIX + sid);
  if (!json) return null;
  try {
    const s = JSON.parse(json) as Session;
    // апдейт lastSeen раз в минуту
    if (Date.now() - s.lastSeenAt > 60_000) {
      s.lastSeenAt = Date.now();
      await redis().set(SESS_PREFIX + sid, JSON.stringify(s), "EX", MAX_AGE);
    }
    return s;
  } catch {
    return null;
  }
}