import { NextResponse } from "next/server";
import { verifyAdminLink } from "@/lib/sign";
import { notifyUserDepositDeclined } from "@/lib/notify";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = process.env.ADMIN_SIGN_KEY || "";
  const payload = verifyAdminLink(
    {
      id: url.searchParams.get("id"),
      user: url.searchParams.get("user"),
      amount: url.searchParams.get("amount"),
      sig: url.searchParams.get("sig"),
    },
    key
  );
  if (!payload) return NextResponse.json({ ok: false, error: "bad_params_or_sig" }, { status: 401 });

  await notifyUserDepositDeclined({ userId: payload.userId, amount: payload.amount });
  return NextResponse.json({ ok: true, updated: payload });
}