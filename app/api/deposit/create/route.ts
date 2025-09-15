import { NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { createDeposit } from "@/lib/deposits";
import { notifyDepositAdmin } from "@/lib/notify";

export async function POST(req: Request) {
  try {
    const { initData, amount } = await req.json();

    // проверка initData
    const botToken = process.env.BOT_TOKEN!;
    const v = verifyInitData(String(initData || ""), botToken);
    if (!v || !v.user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const userId = v.user.id;
    const amt = Math.max(1, Number(amount || 0));

    const dep = createDeposit(userId, amt); // { id, userId, amount, status, createdAt }
    await notifyDepositAdmin({ id: dep.id, userId: dep.userId, amount: dep.amount });

    return NextResponse.json({ ok: true, dep });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}