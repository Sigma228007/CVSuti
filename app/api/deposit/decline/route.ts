import { NextRequest, NextResponse } from "next/server";
import { verifyAdminLink } from "@/lib/sign";
import { getDepositById, declineDeposit } from "@/lib/deposits";
import { notifyUserDepositDeclined } from "@/lib/notify";

export async function GET(req: NextRequest) {
  const q = Object.fromEntries(req.nextUrl.searchParams.entries());
  const v = verifyAdminLink(q);
  if (!v.ok) return NextResponse.json({ ok: false, error: "bad_sig" }, { status: 400 });

  const dep = getDepositById(v.id);
  if (!dep || dep.status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_found_or_not_pending" }, { status: 404 });
  }

  declineDeposit(dep.id);
  await notifyUserDepositDeclined({ userId: Number(v.userId), amount: Number(v.amount) });

  return NextResponse.json({ ok: true, updated: { id: dep.id } });
}