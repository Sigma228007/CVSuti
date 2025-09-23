import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { createDepositRequest } from "@/lib/store";
import crypto from "crypto";
import { notifyDepositAdmin } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    const { amount } = (await req.json().catch(() => ({}))) as { amount?: number };
    const amt = Math.max(1, Math.floor(Number(amount || 0)));

    // создаём pending-депозит
    const dep = await createDepositRequest(uid, amt, "fkwallet");

    // FreeKassa подпись/ссылка
    const merchantId = process.env.FK_MERCHANT_ID || "";
    const secret1    = process.env.FK_SECRET_1   || "";
    const currency   = "RUB";
    const sign = crypto.createHash("md5").update(
      [merchantId, dep.amount, secret1, currency, dep.id].join(":")
    ).digest("hex");

    // ссылка на кассу
    const payUrl = `https://pay.freekassa.com/?m=${merchantId}&oa=${dep.amount}&o=${dep.id}&currency=${currency}&s=${sign}`;

    // Уведомление админу
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