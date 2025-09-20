import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "sid";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 дней

function getSecret() {
  // можно использовать ADMIN_SIGN_KEY из твоего .env
  const s = process.env.ADMIN_SIGN_KEY || process.env.SESSION_SECRET || "dev_secret_change_me";
  return s;
}

function sign(payload: string) {
  const h = crypto.createHmac("sha256", getSecret());
  h.update(payload);
  return h.digest("hex");
}

export function makeSession(uid: number) {
  const ts = Date.now();
  const payload = `${uid}.${ts}`;
  const mac = sign(payload);
  return `${payload}.${mac}`;
}

export function verifySession(raw?: string | null): number | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [uidStr, tsStr, mac] = parts;
  const payload = `${uidStr}.${tsStr}`;
  const expect = sign(payload);
  if (expect !== mac) return null;

  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return null;
  if (Date.now() - ts > SESSION_TTL_MS) return null;

  const uid = Number(uidStr);
  if (!Number.isFinite(uid) || uid <= 0) return null;

  return uid;
}

export function readUidFromCookies(req: NextRequest): number | null {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return verifySession(cookie ?? null);
}

export function setSessionCookie(res: NextResponse, uid: number) {
  const value = makeSession(uid);
  res.cookies.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
  });
}
