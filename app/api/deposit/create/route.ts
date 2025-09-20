import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { createDepositRequest } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Создаёт pending-депозит (без редиректа). Обычно ты используешь /api/pay/start,
 * но этот роут можно дергать, если нужна «прямая» заявка через админку и т.п.
 */
export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    const { amount } = (await req.json().catch(() => ({}))) as { amount?: number };
    const amt = Math.max(1, Math.floor(Number(amount || 0)));

    const dep = await createDepositRequest(uid, amt, "fkwallet");
    return NextResponse.json({ ok: true, deposit: dep });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "create failed" }, { status: 500 });
  }
}