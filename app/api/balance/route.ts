import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/session";
import { getBalance } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const uid = getUidFromRequest(req.headers);
    
    if (!uid) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    
    const bal = await getBalance(uid);
    return NextResponse.json({ ok: true, uid, balance: bal });
    
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "balance failed" },
      { status: 500 }
    );
  }
}