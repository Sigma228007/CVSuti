import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { createWithdrawRequest } from "@/lib/store";
import { notifyWithdrawAdmin } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    const { amount, details } = (await req.json().catch(() => ({}))) as {
      amount?: number;
      details?: any;
    };

    const amt = Math.max(1, Math.floor(Number(amount || 0)));
    const wd = await createWithdrawRequest(uid, amt, details || {});

    // Уведомление админу
    try {
      await notifyWithdrawAdmin(wd);
    } catch (notifyError) {
      console.error('Withdraw notification error:', notifyError);
    }

    return NextResponse.json({ ok: true, withdraw: wd });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "create failed" }, { status: 500 });
  }
}