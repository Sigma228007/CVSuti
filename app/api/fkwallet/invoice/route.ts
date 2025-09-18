import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { verifyInitData } from "@/lib/sign";

function md5(s: string) {
  return createHash("md5").update(s).digest("hex");
}

type Body = { initData?: string; amount?: number };

export async function POST(req: NextRequest) {
  let initData = "";
  let amount = 0;

  try {
    const b = (await req.json()) as Body;
    initData = String(b?.initData || "");
    amount = Number(b?.amount || 0);
  } catch {}

  if (!amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: "bad amount" }, { status: 400 });
  }

  const botToken = process.env.BOT_TOKEN || "";
  if (!initData || !botToken) {
    return NextResponse.json({ ok: false, error: "no initData" }, { status: 401 });
  }

  const v = verifyInitData(initData, botToken);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: "bad initData" }, { status: 401 });
  }
  const userId = v.user.id;

  const merchant = process.env.FK_MERCHANT_ID || "";
  const secret1  = process.env.FK_SECRET_1 || "";
  const currency = process.env.CURRENCY || "RUB";

  if (!merchant || !secret1) {
    return NextResponse.json({ ok: false, error: "FK config missing" }, { status: 500 });
  }

  // уникальный номер заказа
  const orderId = `dep_${Date.now()}_${userId}_${Math.floor(Math.random() * 1e6)}`;

  // классический способ у FreeKassa:
  // s = md5(merchant:amount:secret1:orderId)
  const sign = md5(`${merchant}:${amount}:${secret1}:${orderId}`);

  const base = "https://pay.freekassa.com/"; // .com !
  const url = new URL(base);
  url.searchParams.set("m", merchant);
  url.searchParams.set("oa", String(amount));
  url.searchParams.set("o", orderId);
  url.searchParams.set("s", sign);
  url.searchParams.set("currency", currency);
  // свои параметры, вернутся в callback
  url.searchParams.set("us_uid", String(userId));

  return NextResponse.json({ ok: true, url: url.toString() });
}