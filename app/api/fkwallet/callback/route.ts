import { NextResponse } from "next/server";
import crypto from "crypto";
import { getDeposit, approveDeposit } from "@/lib/store";

function md5(s: string) {
  return crypto.createHash("md5").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let params: URLSearchParams;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      params = new URLSearchParams(await req.text());
    } else if (contentType.includes("multipart/form-data")) {
      // простейший парс как urlencoded — у FK обычно x-www-form-urlencoded
      params = new URLSearchParams(await req.text());
    } else {
      // JSON fallback
      const json = await req.json().catch(() => null);
      if (!json || typeof json !== "object") {
        return new Response("BAD REQUEST", { status: 400 });
      }
      params = new URLSearchParams();
      for (const [k, v] of Object.entries(json)) params.set(k, String(v));
    }

    // поля FreeKassa
    const merchantId =
      params.get("MERCHANT_ID") ||
      params.get("merchant_id") ||
      params.get("m");
    const amount =
      params.get("AMOUNT") || params.get("oa") || params.get("amount");
    const orderId =
      params.get("MERCHANT_ORDER_ID") ||
      params.get("merchant_order_id") ||
      params.get("o");
    const sign = params.get("SIGN") || params.get("s");

    const secret2 = process.env.FK_SECRET_2 || "";
    if (!merchantId || !amount || !orderId || !sign || !secret2) {
      return new Response("BAD REQUEST", { status: 400 });
    }

    // Проверка подписи FK: md5(merchant:amount:secret2:orderId)
    const expected = md5(`${merchantId}:${amount}:${secret2}:${orderId}`);
    if (expected.toLowerCase() !== sign.toLowerCase()) {
      console.warn("FK callback bad sign", { expected, got: sign });
      return new Response("WRONG SIGN", { status: 400 });
    }

    // Сопоставляем заказ с депозитом по id (важно: при создании инвойса orderId = dep.id)
    const dep = await getDeposit(String(orderId));
    if (!dep) {
      console.warn("FK callback deposit not found", { orderId });
      return new Response("NOT FOUND", { status: 404 });
    }

    // (опционально) сверка суммы
    const amtNum = Number(amount);
    if (!Number.isFinite(amtNum) || Math.floor(amtNum) !== dep.amount) {
      console.warn("FK callback amount mismatch", {
        expected: dep.amount,
        got: amount,
      });
      // продолжаем, если политика допускает округление/копейки
    }

    // Помечаем провайдера (у нас поле 'provider' в типе Deposit)
    dep.provider = dep.provider || "FKWallet";
    // Подтверждаем депозит (начислит баланс, снимет из pending, добавит историю)
    await approveDeposit(dep.id);

    // FK ожидает ровно 'YES' в ответ при успешной обработке
    return new Response("YES");
  } catch (e) {
    console.error("FK callback error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}