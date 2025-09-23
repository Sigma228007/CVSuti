import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/session";
import { createDepositRequest } from "@/lib/store";
import crypto from "crypto";
import { notifyDepositAdmin } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const uid = getUidFromRequest(req.headers);
    
    if (!uid) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { amount } = await req.json();
    const amountNum = Math.max(1, Math.floor(Number(amount || 0))); // ← Исправлено: добавил скобку

    const deposit = await createDepositRequest(uid, amountNum, "fkwallet"); // ← Исправлено: "fkwallet" вместо "fwallet"

    const merchantId = process.env.FK_MERCHANT_ID || "";
    const secret1 = process.env.FK_SECRET_1 || "";
    const currency = "RUB";
    
    const sign = crypto.createHash("md5").update(
      [merchantId, deposit.amount, secret1, currency, deposit.id].join(":")
    ).digest("hex");

    // ← Исправлено: правильный шаблон строки
    const payUrl = `https://pay.freekassa.com/?m=${merchantId}&oa=${deposit.amount}&o=${deposit.id}&currency=${currency}&s=${sign}`;

    try {
      await notifyDepositAdmin(deposit);
    } catch (notifyError) {
      console.error('Deposit notification error:', notifyError);
    }

    return NextResponse.json({ ok: true, deposit: deposit, payUrl }); // ← Исправлено: deposit вместо dep
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "create failed" }, { status: 500 });
  }
}