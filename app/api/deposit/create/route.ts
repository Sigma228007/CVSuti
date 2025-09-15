import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { createDeposit } from "@/lib/deposits";
import { notifyDepositAdmin } from "@/lib/notify";

export async function POST(req: NextRequest) {
  try {
    const { initData, amount } = (await req.json()) as { initData?: string; amount?: number };

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
    }

    const botToken = process.env.BOT_TOKEN!;
    const parsed = verifyInitData(initData || "", botToken);
    if (!parsed || !parsed.user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const dep = createDeposit(Number(parsed.user.id), Math.floor(amount));
    await notifyDepositAdmin(dep);

    return NextResponse.json({ ok: true, dep });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}