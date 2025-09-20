import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { listPendingWithdrawals } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(uid: number | null) {
  const ids = (process.env.ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);
  return uid != null && ids.includes(uid);
}

/** Список ожидающих выводов (для админа). */
export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!isAdmin(uid)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const { limit } = (await req.json().catch(() => ({}))) as { limit?: number };
    const pending = await listPendingWithdrawals(Math.max(1, Math.min(200, limit || 50)));
    return NextResponse.json({ ok: true, pending });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "pending failed" }, { status: 500 });
  }
}