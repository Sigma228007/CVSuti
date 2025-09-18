import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { createDepositRequest } from "@/lib/store";
import { notifyDepositAdmin } from "@/lib/notify"; // оставь, если есть notify.ts

type DepositMethod = "card" | "fkwallet";

export async function POST(req: NextRequest) {
  try {
    const { initData, amount, method, meta } = (await req.json()) as {
      initData?: string;
      amount?: number;
      method?: DepositMethod;
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

    const m: DepositMethod = (method === "fkwallet" || method === "card") ? method : "card";

    // <-- ВАЖНО: теперь передаём 3 аргумента (и meta опционально)
    const dep = await createDepositRequest(v.user.id, Math.floor(amt), m, meta);

    // уведомляем админа (если настроен lib/notify.ts)
    try {
      await notifyDepositAdmin({ id: dep.id, userId: dep.userId, amount: dep.amount });
    } catch {}

    return NextResponse.json({ ok: true, id: dep.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}