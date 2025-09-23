import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies, getUidFromRequest } from "@/lib/session";
import { listPendingDeposits, getDeposit } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(uid: number | null) {
  const ids = (process.env.ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);
  return uid != null && ids.includes(uid);
}

/** Список ожидающих депозитов (для админа). */
export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!isAdmin(uid)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const { limit } = (await req.json().catch(() => ({}))) as { limit?: number };
    const pending = await listPendingDeposits(Math.max(1, Math.min(200, limit || 50)));
    return NextResponse.json({ ok: true, pending });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "pending failed" }, { status: 500 });
  }
}

/** Проверка статуса депозита (для пользователя) */
export async function GET(req: NextRequest) {
  try {
    // ПЕРЕДАЕМ ЗАГОЛОВКИ, а не весь request
    const uid = getUidFromRequest(req.headers); // ← ИСПРАВЛЕНО
    if (!uid) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const depositId = url.searchParams.get('id');
    
    if (!depositId) {
      return NextResponse.json({ ok: false, error: "depositId required" }, { status: 400 });
    }

    const deposit = await getDeposit(depositId);
    
    if (!deposit) {
      return NextResponse.json({ ok: false, error: "Deposit not found" }, { status: 404 });
    }

    // Проверяем, что депозит принадлежит пользователю
    if (deposit.userId !== uid) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      deposit: {
        id: deposit.id,
        amount: deposit.amount,
        status: deposit.status,
        createdAt: deposit.createdAt
      }
    });

  } catch (error: any) {
    console.error('Deposit status check error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || "check failed" }, 
      { status: 500 }
    );
  }
}