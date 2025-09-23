import { NextResponse } from "next/server";
import { clearUidCookieFromResponse } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true, message: "Logged out successfully" });
  clearUidCookieFromResponse(res);
  
  return res;
}