import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { createDepositRequest } from "@/lib/store";
import { notifyDepositAdmin } from "@/lib/notify";

export async function POST(req: NextRequest) {
  try {
    const { initData, amount, meta } = (await req.json()) as {
      initData?: string;
      amount?: number;
      meta?: any;
    };

    if (!process.env.BOT_TOKEN) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
    }
    if (!initData) {
      return NextResponse.json({ ok: false, error: "no initData" }, { status: 401 });
    }

    const v = verifyInitData(initData, process.env.BOT_TOKEN);
    if (!v.ok || !v.user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const amt = Number(amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ ok: false, error: "bad amount" }, { status: 400 });
    }

    // Метод пополнения у нас один — FKWallet. Передаём это в meta.provider.
    const dep = await createDepositRequest(v.user.id, Math.floor(amt), {
      provider: "FKWallet",
      ...(meta ?? {}),
    });

    // Уведомление админу (если настроено)
    try {
      await notifyDepositAdmin({ id: dep.id, userId: dep.userId, amount: dep.amount });
    } catch {}

    return NextResponse.json({ ok: true, id: dep.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}