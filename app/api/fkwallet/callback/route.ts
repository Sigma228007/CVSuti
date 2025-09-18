import { NextResponse } from "next/server";
import crypto from "crypto";
import { addBalance } from "@/lib/store";
import { redis } from "@/lib/redis";

function md5(s: string) {
  return crypto.createHash("md5").update(s).digest("hex");
}

/**
 * Примерный формат Freekassa уведомления:
 * POST: { m: merchant, oa: amount, o: orderId, s: sign, ... }
 * sign = md5(merchant:amount:secret2:orderId)  (проверьте в docs)
 */
export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const m = data.get("m")?.toString() || data.get("MERCHANT_ID")?.toString() || "";
    const oa = data.get("oa")?.toString() || data.get("AMOUNT")?.toString() || "";
    const orderId = data.get("o")?.toString() || data.get("ORDER_ID")?.toString() || "";
    const sign = data.get("s")?.toString() || "";

    if (!m || !oa || !orderId || !sign) {
      console.warn("callback missing params", { m, oa, orderId, sign });
      return new Response("bad params", { status: 400 });
    }

    const secret2 = process.env.FK_SECRET_2 || "";
    if (!secret2) return new Response("server misconfig", { status: 500 });

    // Проверяем подпись
    const expected = md5(`${m}:${oa}:${secret2}:${orderId}`);
    if (expected !== sign) {
      console.warn("bad sign", { expected, got: sign });
      return new Response("bad sign", { status: 403 });
    }

    // Получаем userId из redis по orderId (если сохранено)
    let userId: number | null = null;
    try {
      const client = await redis();
      const s = await client.get(`dep:${orderId}`);
      if (s) {
        const parsed = JSON.parse(s);
        userId = parsed.userId;
      }
    } catch (e) {
      console.error("redis read error", e);
    }

    const amount = Math.floor(Number(oa));
    if (!userId) {
      // если userId не найден, возможно нужно сопоставлять по другим данным.
      console.warn("user not found for order", orderId);
      // Тем не менее можно логировать и вернуть OK, Freekassa не будет повторять.
      return new Response("no user", { status: 200 });
    }

    // Зачисляем
    try {
      await addBalance(userId, amount);
      console.log(`credited ${amount} to ${userId} order ${orderId}`);
    } catch (err) {
      console.error("credit error", err);
      return new Response("error", { status: 500 });
    }

    // Вернём 200 — Freekassa посчитает уведомление принятым
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("callback error", e);
    return new Response("server error", { status: 500 });
  }
}