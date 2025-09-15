import { NextRequest, NextResponse } from "next/server";
import { approveDeposit, getDepositById } from "@/lib/deposits";
import { addBalance } from "@/lib/store";
import { notifyUserDepositApproved } from "@/lib/notify";
import { verifyAdminSig, verifyInitData } from "@/lib/sign";

function isAdminId(uid: number) {
  const ids = (process.env.ADMIN_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter(Boolean);
  return ids.includes(uid);
}

export async function GET(req: NextRequest) {
  // режим: клик из Telegram по кнопке (id + sig)
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

  approveDeposit(id);
  addBalance(dep.userId, dep.amount);
  await notifyUserDepositApproved(dep);

  return NextResponse.json({ ok: true, updated: dep });
}

export async function POST(req: NextRequest) {
  // режим: нажали кнопку в админ-панели мини-приложения
  const { initData, requestId, action } = await req.json();
  if (!initData || !requestId || action !== "approve") {
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

  approveDeposit(requestId);
  addBalance(dep.userId, dep.amount);
  await notifyUserDepositApproved(dep);

  return NextResponse.json({ ok: true, updated: dep });
}