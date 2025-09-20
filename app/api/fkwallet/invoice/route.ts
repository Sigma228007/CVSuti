import { NextResponse } from "next/server";
import crypto from "crypto";
import { createDepositRequest } from "@/lib/store";
import { verifyInitData } from "@/lib/sign";

function md5(input: string) {
  return crypto.createHash("md5").update(input).digest("hex");
}

type Body = { amount?: number; initData?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const amount = Number(body.amount || 0);
    if (!amount || amount <= 0) {
      return NextResponse.json({ ok: false, error: "bad amount" }, { status: 400 });
    }

    const merchant = process.env.FK_MERCHANT_ID || "";
    const secret1 = process.env.FK_SECRET_1 || "";
    const currency = process.env.CURRENCY || "RUB";
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: "FK config missing" }, { status: 500 });
    }

    // userId из initData (или 0)
    let userId = 0;
    try {
      const botToken = process.env.BOT_TOKEN || "";
      if (body.initData && botToken) {
        const parsed = verifyInitData(body.initData, botToken);
        if ("ok" in parsed && parsed.ok) userId = parsed.user.id;
      }
    } catch {}

    // 1) создаём pending-депозит (метод fkwallet)
    const dep = await createDepositRequest(userId, Math.floor(amount), "fkwallet");

    // 2) формируем подпись формы FK: md5(merchant:amount:secret1:currency:orderId)
    const orderId = dep.id;
    const sign = md5(`${merchant}:${amount}:${secret1}:${currency}:${orderId}`);

    const base = "https://pay.freekassa.com/";
    const params = new URLSearchParams({
      m: String(merchant),
      oa: String(amount),
      o: String(orderId),
      s: sign,
      currency,
      lang: "ru",
    });

    const url = base + "?" + params.toString();
    return NextResponse.json({ ok: true, url, id: dep.id });
  } catch (err: any) {
    console.error("invoice error", err);
    return NextResponse.json({ ok: false, error: err?.message || "internal" }, { status: 500 });
  }
}