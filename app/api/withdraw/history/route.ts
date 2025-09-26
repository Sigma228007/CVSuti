import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { getUserWithdrawals } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    // Используем новую функцию для получения всех выводов пользователя
    const withdrawHistory = await getUserWithdrawals(uid, 50);

    return NextResponse.json({ 
      ok: true, 
      history: withdrawHistory 
    });
  } catch (e: any) {
    console.error('Withdraw history error:', e);
    return NextResponse.json({ ok: false, error: e?.message || "history failed" }, { status: 500 });
  }
}