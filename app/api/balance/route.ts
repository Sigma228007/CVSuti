import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies, isProbablyTelegram } from "@/lib/session";
import { getBalance } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const uid = await readUidFromCookies(req);
    if (uid) {
      const bal = await getBalance(uid);
      return NextResponse.json({ ok: true, uid, balance: bal });
    }

    // мягкий режим — пускаем, но баланс 0
    if (isProbablyTelegram(req)) {
      return NextResponse.json({ ok: true, uid: null, balance: 0 });
    }

    // явно не из Telegram — блок
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}