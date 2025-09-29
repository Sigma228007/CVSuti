import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/session";
import { createDepositRequest } from "@/lib/store";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const uid = getUidFromRequest(req.headers);

    if (!uid) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { amount } = await req.json();
    const amountNum = Math.max(1, Math.floor(Number(amount || 0)));

    const deposit = await createDepositRequest(uid, amountNum, "fkwallet");

    const merchantId = process.env.FK_MERCHANT_ID || "";
    const secret1 = process.env.FK_SECRET_1 || "";
    const currency = "RUB";

    const sign = crypto.createHash("md5").update(
      [merchantId, deposit.amount, secret1, currency, deposit.id].join(":")
    ).digest("hex");

    const payUrl = `https://pay.freekassa.com/?m=${merchantId}&oa=${deposit.amount}&o=${deposit.id}&currency=${currency}&s=${sign}`;

    console.log('Deposit created:', {
      id: deposit.id,
      userId: uid,
      amount: deposit.amount,
      payUrl: payUrl
    });

    return NextResponse.json({
      ok: true,
      deposit: deposit,
      payUrl
    });
  } catch (e: any) {
    console.error('Deposit creation error:', e);
    const message = e?.message || "create failed";
    let status = 500;

    if (message === "bad amount") {
      status = 400;
    } else if (e?.code === "DEPOSIT_PENDING" || message.includes("активная заявка")) {
      status = 409;
    }

    return NextResponse.json({
      ok: false,
      error: message
    }, { status });
  }
}