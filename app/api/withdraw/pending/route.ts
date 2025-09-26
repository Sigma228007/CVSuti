import { NextRequest, NextResponse } from "next/server";
import { listPendingWithdrawals } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const pendingWithdrawals = await listPendingWithdrawals(3); // Лимит 3 заявок

    return NextResponse.json({ 
      ok: true, 
      withdrawals: pendingWithdrawals 
    });
  } catch (e: any) {
    console.error('Get pending withdrawals error:', e);
    return NextResponse.json({ ok: false, error: e?.message || "Get pending failed" }, { status: 500 });
  }
}