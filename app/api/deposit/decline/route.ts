import { NextRequest, NextResponse } from "next/server";
import { verifyAdminLink } from "@/lib/sign";
import { declineDeposit, getDepositById } from "@/lib/deposits";
import { notifyUserDepositDeclined } from "@/lib/notify";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = process.env.ADMIN_SIGN_KEY || "";
  const verified = verifyAdminLink(url.searchParams, key);
  if (!verified) return NextResponse.json({ ok: false, error: "bad_sig" }, { status: 400 });

  const dep = getDepositById(verified.id);
  if (!dep || dep.status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_found_or_not_pending" }, { status: 404 });
  }

  declineDeposit(verified.id);
  await notifyUserDepositDeclined({ userId: dep.userId, amount: dep.amount });

  return NextResponse.json({ ok: true, updated: dep });
}