import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies, writeUidCookie } from "@/lib/session";
import { getBalance } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    
    const bal = await getBalance(uid);
    const res = NextResponse.json({ ok: true, uid, balance: bal });
    writeUidCookie(res, uid);
    return res;
    
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "balance failed" },
      { status: 500 }
    );
  }
}