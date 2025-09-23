import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { getUserHistory } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    const history = await getUserHistory(uid);
    
    // Расчет статистики
    const deposits = history.filter((item: any) => item.t === 'dep_approved');
    const withdrawals = history.filter((item: any) => item.t === 'wd_approved');
    const bets = history.filter((item: any) => item.t === 'bet');
    
    const totalDeposited = deposits.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const totalWithdrawn = withdrawals.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const totalGames = bets.length;
    const wins = bets.filter((bet: any) => bet.payout > 0).length;

    return NextResponse.json({ 
      ok: true, 
      history,
      totals: {
        dep: totalDeposited,
        wd: totalWithdrawn,
        net: totalDeposited - totalWithdrawn,
        games: totalGames,
        wins: wins
      }
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "history failed" }, { status: 500 });
  }
}