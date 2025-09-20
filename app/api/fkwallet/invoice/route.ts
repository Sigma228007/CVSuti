import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { readUidFromCookies } from "@/lib/session";
import { createDepositRequest } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

    const { amount } = (await req.json().catch(() => ({}))) as { amount?: number };
    const amt = Math.max(1, Math.floor(Number(amount || 0)));

    const dep = await createDepositRequest(uid, amt, "fkwallet");

    const merchId = process.env.FK_MERCHANT_ID || "";
    const s1 = process.env.FK_SECRET_1 || "";
    const currency = "RUB";
    const orderId = dep.id;

    const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");
    const sign = md5(`${merchId}:${amt}:${s1}:${currency}:${orderId}`);

    const url = `https://pay.freekassa.ru/?m=${merchId}&oa=${amt}&o=${orderId}&s=${sign}&currency=${currency}`;

    return NextResponse.json({ ok: true, url, orderId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "invoice failed" }, { status: 500 });
  }
}