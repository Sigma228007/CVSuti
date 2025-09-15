import { NextResponse } from "next/server";
import { verifyAdminLink } from "@/lib/sign";
import { getDepositById, markDeposit } from "@/lib/deposits";
import { addBalance } from "@/lib/store";
import { notifyUserDepositApproved } from "@/lib/notify";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = process.env.ADMIN_SIGN_KEY || "";
  const parsed = verifyAdminLink(url.searchParams, key);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
  }

  const dep = getDepositById(parsed.id);
  if (!dep || dep.status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_found_or_not_pending" }, { status: 404 });
  }

  markDeposit(dep.id, "approved");
  addBalance(parsed.user, parsed.amount);
  await notifyUserDepositApproved({ userId: parsed.user, amount: parsed.amount });

  return NextResponse.json({ ok: true });
}