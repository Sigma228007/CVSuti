import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDeposit, approveDeposit } from "@/lib/store";

// Секреты FreeKassa (второй секрет для проверки callback)
const FK_SECRET_2 = process.env.FK_SECRET_2 || "";

/** Проверка подписи (FreeKassa) */
function checkSign(
  params: Record<string, string | undefined>,
  secret: string
) {
  const sign = (params["SIGN"] || "").toString();
  const keys = ["MERCHANT_ID", "AMOUNT", "MERCHANT_ORDER_ID", "CUR"];
  const str =
    keys.map((k) => (params[k] ?? "")).join(":") + ":" + secret;
  const hash = crypto.createHash("md5").update(str).digest("hex");
  return hash.toLowerCase() === sign.toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    for (const [k, v] of form.entries()) params[k] = String(v);

    const orderId = params["MERCHANT_ORDER_ID"];
    const amount = parseFloat(params["AMOUNT"] || "0");

    // Базовая валидация
    if (!orderId || !amount) {
      return NextResponse.json({ error: "bad params" }, { status: 400 });
    }

    // Проверяем подпись FK
    if (!checkSign(params, FK_SECRET_2)) {
      return NextResponse.json({ error: "bad sign" }, { status: 403 });
    }

    // Ищем депозит по нашему id (dep_xxx)
    const dep = await getDeposit(orderId);
    if (!dep) {
      return NextResponse.json({ error: "dep not found" }, { status: 404 });
    }

    // Идемпотентность — если уже подтверждён, просто отвечаем ок
    if (dep.status === "approved") {
      return NextResponse.json({ ok: true, already: true });
    }

    // Можно добавить доп.проверки (сумма/валюта), если нужно:
    // if (Number(dep.amount) !== Number(amount)) { ... }

    // Помечаем источник
    dep.source = dep.source || "FKWallet";

    // Подтверждаем депозит (история/баланс/удаление из pending внутри)
    await approveDeposit(dep);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[FK callback] error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}