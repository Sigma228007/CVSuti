import { NextRequest, NextResponse } from "next/server";
import { verifyAdminLink } from "@/lib/sign";
import { approveDeposit, getDepositById } from "@/lib/deposits";
import { addBalance } from "@/lib/store";
import { notifyUserDepositApproved } from "@/lib/notify";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const userId = Number(url.searchParams.get("user") || "0");
  const amount = Number(url.searchParams.get("amount") || "0");
  const sig = url.searchParams.get("sig") || "";
  const key = process.env.ADMIN_SIGN_KEY || "";

  if (!verifyAdminLink(sig, id, key)) {
    return NextResponse.json({ ok: false, error: "bad_sig" }, { status: 401 });
  }

  const dep = getDepositById(id);
  if (!dep || dep.status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_found_or_not_pending" }, { status: 400 });
  }

  approveDeposit(id);
  addBalance(userId, amount);
  await notifyUserDepositApproved({ userId, amount });

  return NextResponse.json({ ok: true, updated: dep });
}