import { NextRequest, NextResponse } from "next/server";
import { getWithdraw, declineWithdraw } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { withdrawId } = await req.json();
    if (!withdrawId) {
      return NextResponse.json({ ok: false, error: "Missing withdrawId" }, { status: 400 });
    }

    const withdraw = await getWithdraw(withdrawId);
    if (!withdraw) {
      return NextResponse.json({ ok: false, error: "Withdraw not found" }, { status: 404 });
    }

    if (withdraw.status !== 'pending') {
      return NextResponse.json({ ok: false, error: "Withdraw already processed" }, { status: 400 });
    }

    await declineWithdraw(withdraw);

    return NextResponse.json({ 
      ok: true, 
      message: "Вывод отклонен",
      withdraw: withdraw
    });

  } catch (e: any) {
    console.error('Decline withdraw error:', e);
    return NextResponse.json({ ok: false, error: e?.message || "Decline failed" }, { status: 500 });
  }
}