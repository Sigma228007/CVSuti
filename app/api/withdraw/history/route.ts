import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { getUserHistory } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    // Получаем историю пользователя
    const history = await getUserHistory(uid, 50);
    
    // Фильтруем только выводы
    const withdrawHistory = history
      .filter((item: any) => item.type?.includes('withdraw'))
      .map((item: any) => ({
        id: item.id,
        amount: item.amount,
        details: item.details || '',
        status: item.type === 'withdraw_approved' ? 'approved' : 
               item.type === 'withdraw_declined' ? 'declined' : 'pending',
        createdAt: item.ts || item.createdAt || Date.now()
      }))
      .sort((a: any, b: any) => b.createdAt - a.createdAt);

    return NextResponse.json({ 
      ok: true, 
      history: withdrawHistory 
    });
  } catch (e: any) {
    console.error('Withdraw history error:', e);
    return NextResponse.json({ ok: false, error: e?.message || "history failed" }, { status: 500 });
  }
}