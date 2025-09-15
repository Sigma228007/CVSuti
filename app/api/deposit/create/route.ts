import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { createDeposit } from "@/lib/deposits";
import { notifyDepositAdmin } from "@/lib/notify";

export async function POST(req: NextRequest) {
  try {
    const { initData, amount } = await req.json() as { initData?: string; amount?: number };

    if (!process.env.BOT_TOKEN) {
      return NextResponse.json({ ok:false, error:"server_misconfig: BOT_TOKEN is empty" }, { status:500 });
    }

    if (!initData || typeof initData !== "string") {
      return NextResponse.json({ ok:false, error:"no_initData" }, { status:401 });
    }

    const parsed = verifyInitData(initData, process.env.BOT_TOKEN);
    if (!parsed || !parsed.user?.id) {
      // ВАЖНО: не логируем initData целиком, но дадим подсказку.
      return NextResponse.json({ ok:false, error:"unauthorized: verifyInitData failed" }, { status:401 });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ ok:false, error:"bad_amount" }, { status:400 });
    }

    const dep = createDeposit(parsed.user.id, Math.floor(amt));
    await notifyDepositAdmin(dep);

    return NextResponse.json({ ok:true, dep });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message ?? "server_error" }, { status:500 });
  }
}