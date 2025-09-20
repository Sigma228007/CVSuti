import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { getWithdraw, approveWithdraw } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(uid: number | null) {
  const ids = (process.env.ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);
  return uid != null && ids.includes(uid);
}

/**
 * Подтвердить вывод (админ уже перевёл вручную на реквизиты).
 * В store заявка помечается approved, «резерв» окончательно списывается.
 */
export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!isAdmin(uid)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });

    const wd = await getWithdraw(id);
    if (!wd) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

    if (wd.status === "pending") {
      await approveWithdraw(wd);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "approve failed" }, { status: 500 });
  }
}