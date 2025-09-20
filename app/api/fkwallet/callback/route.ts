import { NextResponse } from "next/server";
import crypto from "crypto";
import { getDeposit, approveDeposit } from "@/lib/store";

function md5(input: string) {
  return crypto.createHash("md5").update(input).digest("hex");
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  let params: URLSearchParams | null = null;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    params = new URLSearchParams(text);
  } else if (contentType.includes("multipart/form-data")) {
    const text = await req.text();
    params = new URLSearchParams(text);
  } else {
    try {
      const json = await req.json();
      params = new URLSearchParams();
      for (const k of Object.keys(json)) params.set(k, String((json as any)[k]));
    } catch {
      return new Response("BAD REQUEST", { status: 400 });
    }
  }

  const merchantId = params.get("MERCHANT_ID") || params.get("merchant_id") || params.get("m");
  const amount = params.get("AMOUNT") || params.get("oa") || params.get("amount");
  const orderId = params.get("MERCHANT_ORDER_ID") || params.get("merchant_order_id") || params.get("o");
  const sign = params.get("SIGN") || params.get("s");

  const secret2 = process.env.FK_SECRET_2 || "";
  if (!merchantId || !amount || !orderId || !sign || !secret2) {
    return new Response("BAD REQUEST", { status: 400 });
  }

  const check = md5(`${merchantId}:${amount}:${secret2}:${orderId}`);
  if (check.toLowerCase() !== sign.toLowerCase()) {
    console.warn("FK callback bad sign", { check, sign });
    return new Response("WRONG SIGN", { status: 400 });
  }

  // Находим депозит по orderId
  const dep = await getDeposit(orderId);
  if (!dep) {
    console.warn("FK callback: deposit not found", { orderId });
    return new Response("NOT FOUND", { status: 404 });
  }

  // Если уже обработан — отвечаем YES повторно (FK любит ретраи)
  if (dep.status !== "pending") {
    return new Response("YES");
  }

  await approveDeposit(dep);

  // Важно: FK требует строгий ответ YES
  return new Response("YES");
}