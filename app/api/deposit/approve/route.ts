import { NextRequest, NextResponse } from "next/server";
import { verifyAdminLink } from "@/lib/sign";
import { getDepositById, approveDeposit } from "@/lib/deposits";
import { addBalance } from "@/lib/store";
import { notifyUserDepositApproved } from "@/lib/notify";

export async function GET(req: NextRequest) {
  const q = Object.fromEntries(req.nextUrl.searchParams.entries());
  const v = verifyAdminLink(q);
  if (!v.ok) return NextResponse.json({ ok: false, error: "bad_sig" }, { status: 400 });

  const dep = getDepositById(v.id);
  if (!dep || dep.status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_found_or_not_pending" }, { status: 404 });
  }

  approveDeposit(dep.id);
  addBalance(Number(v.userId), Number(v.amount));
  await notifyUserDepositApproved({ userId: Number(v.userId), amount: Number(v.amount) });

  return NextResponse.json({
    ok: true,
    updated: { id: dep.id, userId: Number(v.userId), amount: Number(v.amount) },
  });
}