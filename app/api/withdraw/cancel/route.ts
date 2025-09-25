import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { getWithdraw, declineWithdraw, addBalance } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    const { withdrawId } = await req.json();
    if (!withdrawId) {
      return NextResponse.json({ ok: false, error: "Missing withdrawId" }, { status: 400 });
    }

    // Находим заявку на вывод
    const withdraw = await getWithdraw(withdrawId);
    if (!withdraw) {
      return NextResponse.json({ ok: false, error: "Withdraw not found" }, { status: 404 });
    }

    // Проверяем, что заявка принадлежит пользователю
    if (withdraw.userId !== uid) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    if (withdraw.status !== 'pending') {
      return NextResponse.json({ ok: false, error: "Withdraw already processed" }, { status: 400 });
    }

    // Отменяем вывод (возвращаем средства)
    await declineWithdraw(withdraw);

    return NextResponse.json({ 
      ok: true, 
      message: "Заявка на вывод отменена",
      refundAmount: withdraw.amount
    });

  } catch (e: any) {
    console.error('Cancel withdraw error:', e);
    return NextResponse.json({ ok: false, error: e?.message || "Cancel failed" }, { status: 500 });
  }
}