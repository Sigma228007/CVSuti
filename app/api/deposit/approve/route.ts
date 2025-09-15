import { NextRequest, NextResponse } from "next/server";
import { verifyAdminLink } from "@/lib/sign";
import { approveDeposit, getDepositById } from "@/lib/deposits";
import { addBalance } from "@/lib/store";
import { notifyUserDepositApproved } from "@/lib/notify";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = process.env.ADMIN_SIGN_KEY || "";
  const verified = verifyAdminLink(url.searchParams, key);
  if (!verified) return NextResponse.json({ ok: false, error: "bad_sig" }, { status: 400 });

  const dep = getDepositById(verified.id);
  if (!dep || dep.status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_found_or_not_pending" }, { status: 404 });
  }

  approveDeposit(verified.id);
  addBalance(dep.userId, dep.amount);
  await notifyUserDepositApproved({ userId: dep.userId, amount: dep.amount });

  return NextResponse.json({ ok: true, updated: dep });
}