import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { getBalance, createWithdrawRequest } from "@/lib/store"; // Убрали addBalance
import { notifyWithdrawAdmin } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    const { amount, details } = (await req.json().catch(() => ({}))) as {
      amount?: number;
      details?: string;
    };

    const amt = Math.max(1, Math.floor(Number(amount || 0)));
    
    // Проверяем баланс
    const balance = await getBalance(uid);
    if (balance < amt) {
      return NextResponse.json({ ok: false, error: "Недостаточно средств" }, { status: 400 });
    }

    // Проверяем минимальную сумму вывода
    if (amt < 10) {
      return NextResponse.json({ ok: false, error: "Минимальная сумма вывода 10₽" }, { status: 400 });
    }

    if (!details || details.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "Укажите реквизиты для вывода" }, { status: 400 });
    }

    // Убрали списание средств здесь, т.к. это делается внутри createWithdrawRequest

    // Создаем заявку на вывод
    const wd = await createWithdrawRequest(uid, amt, details.trim());

    // Уведомление админу
    try {
      await notifyWithdrawAdmin(wd);
    } catch (notifyError) {
      console.error('Withdraw notification error:', notifyError);
    }

    return NextResponse.json({ 
      ok: true, 
      withdrawRequest: wd,
      message: "Заявка на вывод создана. Ожидайте подтверждения админа."
    });
  } catch (e: any) {
    console.error('Withdraw create error:', e);
    return NextResponse.json({ ok: false, error: e?.message || "Ошибка создания заявки" }, { status: 500 });
  }
}