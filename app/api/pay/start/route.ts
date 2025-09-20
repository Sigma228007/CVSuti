import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyInitData } from "@/lib/sign";
import { createDepositRequest } from "@/lib/store";

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

export async function POST(req: NextRequest) {
  try {
    const { amount, initData } = (await req.json()) as { amount?: number; initData?: string };
    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
    }
    if (!initData) {
      return NextResponse.json({ ok: false, error: "no initData" }, { status: 401 });
    }

    const parsed = verifyInitData(initData, botToken);
    if (!("ok" in parsed) || !parsed.ok) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const userId = parsed.user.id;

    const amt = Math.floor(Number(amount || 0));
    if (!amt || amt <= 0) {
      return NextResponse.json({ ok: false, error: "bad amount" }, { status: 400 });
    }

    const merchant = process.env.FK_MERCHANT_ID || "";
    const secret1 = process.env.FK_SECRET_1 || "";
    const currency = process.env.CURRENCY || "RUB";
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: "FK config missing" }, { status: 500 });
    }

    const dep = await createDepositRequest(userId, amt, "fkwallet");

    const orderId = dep.id;
    const sign = md5(`${merchant}:${amt}:${secret1}:${currency}:${orderId}`);

    const base = "https://pay.freekassa.com/";
    const params = new URLSearchParams({
      m: String(merchant),
      oa: String(amt),
      o: String(orderId),
      s: sign,
      currency,
      lang: "ru",
    });

    const url = base + "?" + params.toString();
    return NextResponse.json({ ok: true, id: dep.id, url });
  } catch (e) {
    console.error("pay start error", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}