import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDeposit, approveDeposit } from "@/lib/store";

export const dynamic = "force-dynamic";

// Секреты FreeKassa (2-е слово для callback)
const FK_SECRET_2 = process.env.FK_SECRET_2 || "";

/**
 * Проверка подписи FreeKassa.
 * Классическая формула: md5(MERCHANT_ID:AMOUNT:MERCHANT_ORDER_ID:SECRET2)
 * У некоторых конфигураций используется вариант с включённой валютой.
 */
function checkSign(params: Record<string, string>, secret: string): boolean {
  const mid = params["MERCHANT_ID"] ?? "";
  const amt = params["AMOUNT"] ?? "";
  const ord = params["MERCHANT_ORDER_ID"] ?? "";
  const cur = params["CUR"] ?? "";
  const sign = (params["SIGN"] || "").toLowerCase();

  const make = (s: string) =>
    crypto.createHash("md5").update(s).digest("hex").toLowerCase();

  // 1) без валюты
  const s1 = `${mid}:${amt}:${ord}:${secret}`;
  if (make(s1) === sign) return true;

  // 2) с валютой (если её присылают)
  if (cur) {
    const s2 = `${mid}:${amt}:${ord}:${secret}:${cur}`;
    if (make(s2) === sign) return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    for (const [k, v] of form.entries()) {
      params[String(k)] = String(v);
    }

    const orderId = params["MERCHANT_ORDER_ID"];   // у нас id депозита вида dep_xxx
    const amountStr = params["AMOUNT"] || "0";
    const amount = Number.parseFloat(amountStr);

    if (!orderId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "bad params" }, { status: 400 });
    }

    // Подпись
    if (!checkSign(params, FK_SECRET_2)) {
      return NextResponse.json({ error: "bad sign" }, { status: 403 });
    }

    // Депозит должен быть создан заранее (через /api/pay/start)
    const dep = await getDeposit(orderId);
    if (!dep) {
      return NextResponse.json({ error: "dep not found" }, { status: 404 });
    }

    // Идемпотентность: если уже подтверждён — выходим
    if (dep.status === "approved") {
      return NextResponse.json({ ok: true, already: true });
    }

    // (опционально) можно сверить сумму с депонентной
    // if (Math.round(dep.amount) !== Math.round(amount)) { ... }

    // Подтверждаем депозит: баланс пополнится и история запишется внутри approveDeposit
    await approveDeposit(dep.id);

    // Для FreeKassa достаточно 200-го ответа.
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "internal error" },
      { status: 500 }
    );
  }
}