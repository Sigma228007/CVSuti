import { NextRequest, NextResponse } from "next/server";
import { createDeposit } from "@/lib/deposits";
import { notifyDepositAdmin } from "@/lib/notify";
import { verifyInitData } from "@/lib/sign";

export async function POST(req: NextRequest) {
  try {
    const initData = req.headers.get("x-telegram-init-data") || "";
    if (!initData) return NextResponse.json({ ok: false, error: "no initData" }, { status: 400 });

    const parsed = verifyInitData(initData, process.env.BOT_TOKEN!);
    if (!parsed?.user?.id) return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });

    const { amount } = (await req.json()) as { amount: number };
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt < 1) {
      return NextResponse.json({ ok: false, error: "bad amount" }, { status: 400 });
    }

    const dep = createDeposit(parsed.user.id, amt);
    await notifyDepositAdmin(dep); // админам уходит заявка с кнопками

    return NextResponse.json({ ok: true, id: dep.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "error" }, { status: 500 });
  }
}