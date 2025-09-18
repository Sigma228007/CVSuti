import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { addBalance } from "@/lib/store";

// Нужные ENV:
// FK_MERCHANT_ID
// FK_SECRET_2

function md5(s: string) {
  return crypto.createHash("md5").update(s).digest("hex");
}

export async function GET(req: NextRequest) {
  try {
    const MERCHANT_ID = process.env.FK_MERCHANT_ID || "";
    const SECRET_2 = process.env.FK_SECRET_2 || "";

    if (!MERCHANT_ID || !SECRET_2) {
      return new NextResponse("env_error", { status: 500 });
    }

    // FreeKassa шлёт GET-параметры
    const url = new URL(req.url);
    const m = url.searchParams.get("MERCHANT_ID") || url.searchParams.get("m") || "";
    const amount = url.searchParams.get("AMOUNT") || url.searchParams.get("oa") || "";
    const orderId = url.searchParams.get("intid") || url.searchParams.get("o") || url.searchParams.get("MERCHANT_ORDER_ID") || "";
    const sign = url.searchParams.get("SIGN") || url.searchParams.get("s") || "";

    // Пример подписи FK (для нотификаций): md5(MERCHANT_ID:AMOUNT:SECRET_2:ORDER_ID)
    const expected = md5(`${MERCHANT_ID}:${amount}:${SECRET_2}:${orderId}`);
    if (sign.toLowerCase() !== expected.toLowerCase()) {
      return new NextResponse("bad_sign", { status: 400 });
    }

    // Достаём userId из нашего orderId (мы так формировали его в invoice)
    // fk_<ts>_<userId>_<rnd>
    const parts = (orderId || "").split("_");
    const userId = Number(parts[2] || 0);
    const amt = Math.floor(Number(amount));
    if (!userId || !(amt > 0)) {
      return new NextResponse("bad_data", { status: 400 });
    }

    await addBalance(userId, amt);

    // Важно: FK ждёт любой 200 OK, чтобы засчитать колбэк как принятый
    return new NextResponse("OK", { status: 200 });
  } catch (e) {
    console.error("fk callback error", e);
    return new NextResponse("server_error", { status: 500 });
  }
}