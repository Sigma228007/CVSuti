import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { createWithdrawRequest } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Создаёт заявку на вывод.
 * Ожидается, что в store при создании сумма уходит в «резерв» (списывается временно).
 */
export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    const { amount, details } = (await req.json().catch(() => ({}))) as {
      amount?: number;
      details?: any; // любые реквизиты (карта, кошелёк и т.д.)
    };

    const amt = Math.max(1, Math.floor(Number(amount || 0)));
    const wd = await createWithdrawRequest(uid, amt, details || {});
    return NextResponse.json({ ok: true, withdraw: wd });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "create failed" }, { status: 500 });
  }
}