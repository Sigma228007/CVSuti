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

    const { amount } = (await req.json().catch(() => ({}))) as { amount?: number };
    const amt = Math.max(1, Math.floor(Number(amount || 0)));

    const dep = await createDepositRequest(uid, amt, "fkwallet");

    const merchantId = process.env.FK_MERCHANT_ID || "";
    const secret1 = process.env.FK_SECRET_1 || "";
    const currency = "RUB";
    
    const sign = crypto.createHash("md5").update(
      [merchantId, dep.amount, secret1, currency, dep.id].join(":")
    ).digest("hex");

    const payUrl = `https://pay.freekassa.com/?m=${merchantId}&oa=${dep.amount}&o=${dep.id}&currency=${currency}&s=${sign}`;

    try {
      await notifyDepositAdmin(dep);
    } catch (notifyError) {
      console.error('Deposit notification error:', notifyError);
    }

    return NextResponse.json({ ok: true, deposit: dep, payUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "create failed" }, { status: 500 });
  }
}