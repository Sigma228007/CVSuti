import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Нужные ENV:
// FK_MERCHANT_ID=12345
// FK_SECRET_1=xxx
// CURRENCY=RUB (по умолчанию RUB)
// BOT_TOKEN=<токен телеграм-бота>

type TgUser = { id: number; first_name?: string; username?: string };

function verifyInitData(initData: string, botToken: string): { ok: boolean; user?: TgUser } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const myHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (myHash !== hash) return { ok: false };
    const userStr = params.get("user");
    if (!userStr) return { ok: false };
    const user = JSON.parse(userStr) as TgUser;
    return { ok: true, user };
  } catch {
    return { ok: false };
  }
}

function md5(s: string) {
  return crypto.createHash("md5").update(s).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { initData, amount } = (await req.json()) as { initData?: string; amount?: number };

    const BOT_TOKEN = process.env.BOT_TOKEN || "";
    const MERCHANT_ID = process.env.FK_MERCHANT_ID || "";
    const SECRET_1 = process.env.FK_SECRET_1 || "";
    const CURRENCY = process.env.CURRENCY || "RUB";

    if (!BOT_TOKEN) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
    }
    if (!MERCHANT_ID || !SECRET_1) {
      return NextResponse.json({ ok: false, error: "FreeKassa env missing" }, { status: 500 });
    }
    if (!initData || !amount || amount <= 0) {
      return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    }

    const v = verifyInitData(initData, BOT_TOKEN);
    if (!v.ok || !v.user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const userId = v.user.id;
    const orderId = `fk_${Date.now()}_${userId}_${Math.floor(Math.random() * 1e6)}`;

    // Подпись FreeKassa: s = md5(MERCHANT_ID:AMOUNT:SECRET_1:ORDER_ID)
    // (для стандартной схемы). Сумма должна быть строкой в «обычной» десятичной записи.
    const amt = String(Number(amount));
    const sign = md5(`${MERCHANT_ID}:${amt}:${SECRET_1}:${orderId}`);

    // URL на оплату
    const params = new URLSearchParams({
      m: MERCHANT_ID,
      oa: amt,
      o: orderId,
      s: sign,
      currency: CURRENCY,
    });

    const payUrl = `https://pay.freekassa.ru/?${params.toString()}`;

    // Можно сохранить orderId → userId локально (для доп. контроля),
    // но в нашем колбэке мы всё равно проверим подпись FK (SECRET_2).

    return NextResponse.json({ ok: true, url: payUrl, orderId });
  } catch (e) {
    console.error("fk invoice error", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}