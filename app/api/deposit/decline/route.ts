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
    const res = verifyAdminLink(url.searchParams.toString(), key);
    const payload: any =
      res && typeof res === "object" && "ok" in res ? (res as any).ok ? (res as any).payload : null : res;

    if (!payload || !payload.id || !payload.userId || !payload.amount) {
      return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
    }

    const dep = await getDeposit(payload.id);
    if (!dep) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    if (dep.status !== "pending") return NextResponse.json({ ok: false, error: "not_pending" }, { status: 400 });

    if (dep.userId !== payload.userId || dep.amount !== payload.amount) {
      return NextResponse.json({ ok: false, error: "mismatch" }, { status: 400 });
    }

    await declineDeposit(dep.id);

    try { await notifyUserDepositDeclined({ userId: dep.userId, amount: dep.amount }); } catch {}

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}