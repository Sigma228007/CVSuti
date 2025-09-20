import { NextRequest, NextResponse } from "next/server";
import { verifyAdminLink } from "@/lib/sign";
import { getDeposit, declineDeposit } from "@/lib/store";
import { notifyUserDepositDeclined } from "@/lib/notify";

export async function GET(req: NextRequest) {
  try {
    const key = process.env.ADMIN_SIGN_KEY || "";
    if (!key) {
      return NextResponse.json({ ok: false, error: "ADMIN_SIGN_KEY missing" }, { status: 500 });
    }

    const url = new URL(req.url);
    const token = url.searchParams.get("sig") || "";
    const id    = url.searchParams.get("id")  || "";

    if (!token || !id) {
      return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
    }

    const dep = await getDeposit(id);
    if (!dep || dep.status !== "pending") {
      return NextResponse.json({ ok: false, error: "not_pending" }, { status: 400 });
    }

    const v = verifyAdminLink(token, key);
    if (!("ok" in v) || !v.ok || v.payload?.id !== dep.id) {
      return NextResponse.json({ ok: false, error: "bad_sig" }, { status: 400 });
    }

    await declineDeposit(dep);

    try { await notifyUserDepositDeclined({ userId: dep.userId, amount: dep.amount }); } catch {}

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}