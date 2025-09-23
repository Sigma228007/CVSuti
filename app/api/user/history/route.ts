import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies, getUidFromRequest } from "@/lib/session";
import { getUserHistory } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const uid = getUidFromRequest(req.headers);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    // ✅ Исправленный вызов - только 2 аргумента (userId и limit)
    const history = await getUserHistory(uid, limit);
    
    // Расчет статистики
    const deposits = history.filter((item: any) => item.type === 'deposit_approved' || item.t === 'dep_approved');
    const withdrawals = history.filter((item: any) => item.type === 'withdraw_approved' || item.t === 'wd_approved');
    const bets = history.filter((item: any) => item.type === 'bet' || item.t === 'bet');
    
    const totalDeposited = deposits.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const totalWithdrawn = withdrawals.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const totalGames = bets.length;
    const wins = bets.filter((bet: any) => (bet.payout > 0) || (bet.win === true)).length;

    return NextResponse.json({ 
      ok: true, 
      history,
      stats: {
        totalDeposited,
        totalWithdrawn,
        netProfit: totalDeposited - totalWithdrawn,
        totalGames,
        wins,
        losses: totalGames - wins
      }
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "history failed" }, { status: 500 });
  }
}