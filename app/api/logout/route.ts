import { NextResponse } from "next/server";
import { clearUidCookieFromResponse } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearUidCookieFromResponse(res);
  return res;
}