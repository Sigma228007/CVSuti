import { NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { createDeposit } from "@/lib/deposits";
import { notifyDepositAdmin } from "@/lib/notify";

export async function POST(req: Request) {
  try {
    const { initData, amount } = await req.json();

    if (!initData || !Number.isFinite(Number(amount)))
      return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });

    const botToken = process.env.BOT_TOKEN!;
    const auth = verifyInitData(initData, botToken);
    if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const dep = createDeposit(auth.id, Math.floor(Number(amount)));
    await notifyDepositAdmin({ id: dep.id, userId: dep.userId, amount: dep.amount });

    return NextResponse.json({ ok: true, dep });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}