import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyInitData } from "@/lib/sign";
import { createDepositRequest } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const { initData, amount } = (await req.json()) as {
      initData?: string;
      amount?: number;
    };

    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
    }
    if (!initData) {
      return NextResponse.json({ ok: false, error: "no initData" }, { status: 401 });
    }

    const parsed = verifyInitData(initData, botToken);
    if (!parsed.ok || !parsed.user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const amt = Number(amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ ok: false, error: "bad amount" }, { status: 400 });
    }

    const userId = parsed.user.id;

    const merchant = process.env.FK_MERCHANT_ID || "";
    const secret1 = process.env.FK_SECRET_1 || "";
    const currency = process.env.CURRENCY || "RUB";
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: "FK config missing" }, { status: 500 });
    }

    // создаём pending-депозит; источник сохраняем в meta.provider
    const dep = await createDepositRequest(userId, Math.floor(amt), { provider: "FKWallet" });

    // формируем подпись FreeKassa: md5(merchant:amount:secret1:currency:orderId)
    const orderId = dep.id;
    const sign = crypto
      .createHash("md5")
      .update(`${merchant}:${amt}:${secret1}:${currency}:${orderId}`)
      .digest("hex");

    const base = "https://pay.freekassa.com/";
    const params = new URLSearchParams({
      m: String(merchant),
      oa: String(amt),
      o: String(orderId),
      s: sign,
      currency,
      lang: "ru",
      us_uid: String(userId),
    });
    const url = `${base}?${params.toString()}`;

    return NextResponse.json({ ok: true, id: dep.id, url });
  } catch (e) {
    console.error("pay/start error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}