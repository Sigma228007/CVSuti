import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const FK_MERCHANT_ID = process.env.FK_MERCHANT_ID!;
const FK_SECRET_1    = process.env.FK_SECRET_1!;
const CURRENCY       = process.env.CURRENCY || "RUB";

export async function POST(req: NextRequest) {
  try {
    const { initData, amount } = await req.json();

    // (опционально) проверить initData — у тебя уже есть verify на бэке
    if (!amount || amount < 1) {
      return NextResponse.json({ ok: false, error: "bad_amount" }, { status: 400 });
    }

    // Генерим order_id (для удобства можно префикс dep_)
    const orderId = `dep_${Date.now()}`;

    // Простейшая подпись (пример — уточни под свой тариф/метод FK)
    const sign = crypto
      .createHash("md5")
      .update(`${FK_MERCHANT_ID}:${amount}:${FK_SECRET_1}:${orderId}`)
      .digest("hex");

    // Ссылка оплаты (актуальный базовый URL смотри в кабинете FreeKassa/FKWallet)
    const url = new URL("https://pay.freekassa.ru/");
    url.searchParams.set("m", FK_MERCHANT_ID);
    url.searchParams.set("oa", String(amount));
    url.searchParams.set("o", orderId);
    url.searchParams.set("s", sign);
    url.searchParams.set("currency", CURRENCY);

    // ВАЖНО: возвращаем JSON, а не редирект
    return NextResponse.json({ ok: true, url: url.toString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}