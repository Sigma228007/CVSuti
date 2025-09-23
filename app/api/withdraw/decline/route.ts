import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { getWithdraw, declineWithdraw } from "@/lib/store";
import { notifyUserWithdrawDeclined } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(uid: number | null) {
  const ids = (process.env.ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);
  return uid != null && ids.includes(uid);
}

export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!isAdmin(uid)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });

    const wd = await getWithdraw(id);
    if (!wd) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

    if (wd.status === "pending") {
      await declineWithdraw(wd);
      
      // Уведомление пользователю
      try {
        await notifyUserWithdrawDeclined(wd);
      } catch (notifyError) {
        console.error('Withdraw decline notification error:', notifyError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "decline failed" }, { status: 500 });
  }
}