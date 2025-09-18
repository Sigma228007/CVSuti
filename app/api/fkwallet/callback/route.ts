import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { addBalance, markProcessedOnce } from "@/lib/store";

function md5(s: string) {
  return createHash("md5").update(s).digest("hex");
}

export async function POST(req: NextRequest) {
  const fd = await req.formData();

  // FreeKassa может прислать в разных регистрах / форматах — читаем с запасом
  const merchantId = (fd.get("MERCHANT_ID") || fd.get("merchant_id") || fd.get("m") || "") as string;
  const amountRaw  = (fd.get("AMOUNT") || fd.get("amount") || fd.get("oa") || "") as string;
  const orderId    = (fd.get("MERCHANT_ORDER_ID") || fd.get("merchant_order_id") || fd.get("o") || "") as string;
  const sign       = (fd.get("SIGN") || fd.get("sign") || fd.get("s") || "") as string;

  const amount = Number(amountRaw);
  const secret2 = process.env.FK_SECRET_2 || "";

  if (!merchantId || !orderId || !sign || !amount || !secret2) {
    return new NextResponse("BAD", { status: 400 });
  }

  // подпись callback: md5(merchant_id:amount:secret2:order_id)
  const check = md5(`${merchantId}:${amount}:${secret2}:${orderId}`);
  if (check.toLowerCase() !== sign.toLowerCase()) {
    return new NextResponse("BAD SIGN", { status: 400 });
  }

  // user id из наших пользовательских полей
  const uidStr = (fd.get("us_uid") || fd.get("us_user") || "") as string;
  const uid = Number(uidStr || orderId.split("_")[1]);
  if (!uid) return new NextResponse("BAD UID", { status: 400 });

  // защита от повторного зачисления (дубли callback'ов)
  const first = await markProcessedOnce(orderId);
  if (!first) return new NextResponse("OK"); // уже зачисляли

  await addBalance(uid, amount);
  return new NextResponse("OK");
}