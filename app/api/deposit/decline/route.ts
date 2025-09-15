import { NextRequest, NextResponse } from "next/server";
import { declineDeposit } from "@/lib/deposits";
import { notifyUserDepositDeclined } from "@/lib/notify";
import { verifyAdminSig } from "@/lib/sign";

export async function POST(req: NextRequest) {
  try {
    const { id, sig } = (await req.json()) as { id: string; sig: string };

    if (!id || !sig) return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });
    if (!verifyAdminSig(id, sig, process.env.ADMIN_SIGN_KEY!)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const dep = declineDeposit(id);
    await notifyUserDepositDeclined(dep);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "error" }, { status: 500 });
  }
}