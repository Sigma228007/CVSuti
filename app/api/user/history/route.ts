import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { getUserHistory } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    const history = await getUserHistory(uid);
    return NextResponse.json({ ok: true, history });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "history failed" }, { status: 500 });
  }
}