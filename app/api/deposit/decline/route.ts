import { NextRequest, NextResponse } from "next/server";
import { verifyAdminLink } from "@/lib/sign";
import { declineDeposit, getDepositById } from "@/lib/deposits";
import { notifyUserDepositDeclined } from "@/lib/notify";

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

  declineDeposit(id);
  await notifyUserDepositDeclined({ userId, amount });

  return NextResponse.json({ ok: true, updated: dep });
}