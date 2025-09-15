import { NextRequest, NextResponse } from "next/server";
import { declineDeposit, getDepositById } from "@/lib/deposits";
import { notifyUserDepositDeclined } from "@/lib/notify";
import { verifyAdminSig, verifyInitData } from "@/lib/sign";

function isAdminId(uid: number) {
  const ids = (process.env.ADMIN_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter(Boolean);
  return ids.includes(uid);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const sig = url.searchParams.get("sig") || "";

  if (!id || !sig) {
    return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });
  }

  const key = process.env.ADMIN_SIGN_KEY || "";
  if (!verifyAdminSig(id, sig, key)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const dep = getDepositById(id);
  if (!dep || dep.status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_found_or_not_pending" }, { status: 404 });
  }

  declineDeposit(id);
  await notifyUserDepositDeclined(dep);

  return NextResponse.json({ ok: true, updated: dep });
}

export async function POST(req: NextRequest) {
  const { initData, requestId, action } = await req.json();
  if (!initData || !requestId || action !== "decline") {
    return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });
  }

  const botToken = process.env.BOT_TOKEN!;
  const parsed = verifyInitData(initData, botToken);
  const uid = Number(parsed?.user?.id || 0);
  if (!uid || !isAdminId(uid)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const dep = getDepositById(requestId);
  if (!dep || dep.status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_found_or_not_pending" }, { status: 404 });
  }

  declineDeposit(requestId);
  await notifyUserDepositDeclined(dep);

  return NextResponse.json({ ok: true, updated: dep });
}