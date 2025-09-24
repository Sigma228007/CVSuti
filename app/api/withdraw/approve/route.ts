import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSignature } from "@/lib/sign";
import { getWithdraw, approveWithdraw } from "@/lib/store";
import { notifyUserWithdrawApproved } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const sig = searchParams.get('sig');

    if (!id || !sig) {
      return NextResponse.json({ ok: false, error: "Missing parameters" }, { status: 400 });
    }

    // Проверяем подпись админа
    const isValid = verifyAdminSignature({ id }, sig);
    if (!isValid) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    // Находим заявку на вывод (используем существующую функцию getWithdraw)
    const withdraw = await getWithdraw(id);
    if (!withdraw) {
      return NextResponse.json({ ok: false, error: "Withdraw not found" }, { status: 404 });
    }

    if (withdraw.status !== 'pending') {
      return NextResponse.json({ ok: false, error: "Withdraw already processed" }, { status: 400 });
    }

    // Обновляем статус на approved (используем существующую функцию approveWithdraw)
    await approveWithdraw(withdraw);

    // Уведомляем пользователя
    try {
      await notifyUserWithdrawApproved({
        userId: withdraw.userId,
        amount: withdraw.amount,
        id: withdraw.id
      });
    } catch (notifyError) {
      console.error('Notification error:', notifyError);
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Вывод успешно подтвержден",
      redirect: "/admin" 
    });

  } catch (e: any) {
    console.error('Approve withdraw error:', e);
    return NextResponse.json({ ok: false, error: e?.message || "Approval failed" }, { status: 500 });
  }
}