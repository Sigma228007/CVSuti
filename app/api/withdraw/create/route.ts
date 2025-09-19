import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { createWithdrawRequest } from "@/lib/store";
import { notifyWithdrawAdmin } from "@/lib/notify";

export async function POST(req: NextRequest) {
  try {
    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken) return NextResponse.json({ ok:false, error:"BOT_TOKEN missing" }, { status:500 });

    const { amount, details, initData } = (await req.json()) as {
      amount?: number;
      details?: any; // { card?: string, comment?: string } и т.п.
      initData?: string;
    };

    if (!initData) return NextResponse.json({ ok:false, error:"no initData" }, { status:401 });

    const v = verifyInitData(initData, botToken);
    if (!v.ok || !v.user) return NextResponse.json({ ok:false, error:"unauthorized" }, { status:401 });

    const amt = Math.floor(Number(amount || 0));
    if (!Number.isFinite(amt) || amt <= 0) return NextResponse.json({ ok:false, error:"bad amount" }, { status:400 });

    // создаём pending-заявку и РЕЗЕРВИРУЕМ средства (списываем)
    const wd = await createWithdrawRequest(v.user.id, amt, details ?? null);

    // уведомим админа
    try {
      await notifyWithdrawAdmin({ id: wd.id, userId: wd.userId, amount: wd.amount, details: wd.details });
    } catch {}

    return NextResponse.json({ ok: true, id: wd.id });
  } catch (e) {
    return NextResponse.json({ ok:false, error:"server_error" }, { status:500 });
  }
}