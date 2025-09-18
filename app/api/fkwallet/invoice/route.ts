import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

type TgUser = { id: number; first_name?: string; username?: string };

function verifyInitData(initData: string, botToken: string) {
  try {
    if (!initData || !botToken) return { ok: false, reason: "missing_init_or_token" };
    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const myHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (myHash !== hash) return { ok: false, reason: "bad_signature" };

    const userStr = params.get("user");
    if (!userStr) return { ok: false, reason: "no_user" };

    const user = JSON.parse(userStr) as TgUser;
    return { ok: true, user };
  } catch (e) {
    return { ok: false, reason: "exception" };
  }
}

export async function POST(req: NextRequest) {
  const { initData, amount } = (await req.json()) as { initData?: string; amount?: number };

  const BOT_TOKEN = process.env.BOT_TOKEN || "";
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "BOT_TOKEN_missing" }, { status: 500 });
  }

  const v = verifyInitData(initData || "", BOT_TOKEN);
  if (!v.ok) {
    // вернём reason, чтобы в консоли сразу было видно ПОЧЕМУ 401
    return NextResponse.json({ ok: false, error: "unauthorized", reason: v.reason }, { status: 401 });
  }

  if (!amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: "bad_amount" }, { status: 400 });
  }

  // --- формируем ссылку на платёж FKWallet / FreeKassa ---
  const MERCHANT_ID = process.env.FK_MERCHANT_ID;
  const SECRET_1 = process.env.FK_SECRET_1;
  if (!MERCHANT_ID || !SECRET_1) {
    return NextResponse.json({ ok: false, error: "fk_env_missing" }, { status: 500 });
  }

  const orderId = `dep_${Date.now()}_${v.user!.id}`;
  const sign = crypto
    .createHash("md5")
    .update(`${MERCHANT_ID}:${amount}:${SECRET_1}:${orderId}`)
    .digest("hex");

  // классическая форма FreeKassa
  const url = `https://pay.freekassa.ru/?m=${MERCHANT_ID}&oa=${amount}&o=${orderId}&s=${sign}&currency=RUB`;

  // возвращаем ссылку, фронт откроет её во внешнем браузере
  return NextResponse.json({ ok: true, url, orderId });
}