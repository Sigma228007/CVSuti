import { NextRequest, NextResponse } from "next/server";
import { verifyAdminLink } from "@/lib/sign";
import { getWithdraw, approveWithdraw } from "@/lib/store";
import { notifyUserWithdrawApproved } from "@/lib/notify";

export async function GET(req: NextRequest) {
  try {
    const key = process.env.ADMIN_SIGN_KEY || "";
    if (!key) return NextResponse.json({ ok:false, error:"ADMIN_SIGN_KEY missing" }, { status:500 });

    const url = new URL(req.url);
    const res = verifyAdminLink(url.searchParams.toString(), key);
    const payload: any =
      res && typeof res === "object" && "ok" in res ? (res as any).ok ? (res as any).payload : null : res;

    if (!payload || !payload.id || !payload.user || !payload.amount) {
      return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
    }

    const wd = await getWithdraw(payload.id);
    if (!wd) return NextResponse.json({ ok:false, error:"not_found" }, { status:404 });
    if (wd.status !== "pending") return NextResponse.json({ ok:false, error:"not_pending" }, { status:400 });
    if (wd.userId !== payload.user || wd.amount !== payload.amount) {
      return NextResponse.json({ ok:false, error:"mismatch" }, { status:400 });
    }

    await approveWithdraw(wd.id);
    try { await notifyUserWithdrawApproved({ userId: wd.userId, amount: wd.amount }); } catch {}

    return NextResponse.json({ ok:true, updated: { userId: wd.userId, amount: wd.amount } });
  } catch {
    return NextResponse.json({ ok:false, error:"server_error" }, { status:500 });
  }
}