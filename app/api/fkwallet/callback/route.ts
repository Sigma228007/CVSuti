import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { approveDeposit, getDeposit } from "@/lib/store";

export const runtime = "nodejs"; // на Edge нельзя читать raw form-data удобно

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const m_id = String(form.get("MERCHANT_ID") || form.get("m_id") || "");
    const amount = String(form.get("AMOUNT") || form.get("oa") || "");
    const intid = String(form.get("intid") || ""); // id платежа у FK (можно логировать)
    const order_id = String(form.get("MERCHANT_ORDER_ID") || form.get("o") || form.get("order_id") || "");
    const sign = String(form.get("SIGN") || form.get("sign") || "");

    const secret2 = process.env.FK_SECRET_2 || "";
    if (!m_id || !amount || !order_id || !sign || !secret2) {
      return new Response("bad_params", { status: 400 });
    }

    // Проверка подписи FK (секрет 2):
    // sign = md5(MERCHANT_ID:AMOUNT:SECRET_2:ORDER_ID)
    const raw = `${m_id}:${amount}:${secret2}:${order_id}`;
    const my = crypto.createHash("md5").update(raw).digest("hex");

    if (my.toLowerCase() !== sign.toLowerCase()) {
      return new Response("bad_sign", { status: 403 });
    }

    // найдём нашу заявку и заапрувим (+зачислим баланс)
    const dep = await getDeposit(order_id);
    if (!dep) return new Response("not_found", { status: 404 });
    if (dep.status !== "pending") return new Response("already_done", { status: 200 });

    await approveDeposit(order_id);

    // По протоколу FK на Result URL достаточно вернуть любой текст, обычно "YES"
    return new Response("YES");
  } catch (e) {
    console.error("FK callback error:", e);
    return new Response("server_error", { status: 500 });
  }
}

// иногда FK дёргает GET — разрешим ответом 200
export async function GET() {
  return NextResponse.json({ ok: true });
}