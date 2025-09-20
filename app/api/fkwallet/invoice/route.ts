import { NextResponse } from "next/server";
import crypto from "crypto";
import { createDepositRequest } from "@/lib/store";
import { verifyInitData } from "@/lib/sign";

type Body = { amount?: number; initData?: string };

function md5(s: string) {
  return crypto.createHash("md5").update(s).digest("hex");
}

// Пытаемся извлечь userId из initData на всякий случай
function extractUserId(initData?: string): number | null {
  if (!initData) return null;
  try {
    const p = new URLSearchParams(initData);
    const userStr = p.get("user");
    if (userStr) {
      const u = JSON.parse(userStr);
      if (u && typeof u.id === "number") return u.id;
    }
  } catch {}
  // fallback грубым regex
  try {
    const m = /"id"\s*:\s*(\d{5,})/.exec(initData);
    if (m) return Number(m[1]);
  } catch {}
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const amount = Number(body.amount || 0);
    const initData = body.initData || "";

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "bad amount" }, { status: 400 });
    }

    // Verify Telegram initData → гарантируем корректный userId
    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken || !initData) {
      return NextResponse.json({ ok: false, error: "no initData" }, { status: 401 });
    }
    const v = verifyInitData(initData, botToken);
    if (!v.ok || !v.user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const userId = v.user.id ?? extractUserId(initData) ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "no userId" }, { status: 401 });
    }

    const merchant = process.env.FK_MERCHANT_ID || "";
    const secret1 = process.env.FK_SECRET_1 || "";
    const currency = process.env.CURRENCY || "RUB";
    if (!merchant || !secret1) {
      return NextResponse.json({ ok: false, error: "FK config missing" }, { status: 500 });
    }

    // 1) создаём pending-депозит (источник FKWallet сохраняем в meta.provider)
    const dep = await createDepositRequest(userId, Math.floor(amount), { provider: "FKWallet" });

    // 2) формируем подпись ссылки FK: md5(merchant:amount:secret1:currency:orderId)
    const orderId = dep.id;
    const sign = md5(`${merchant}:${amount}:${secret1}:${currency}:${orderId}`);

    // 3) собираем URL FreeKassa
    const base = "https://pay.freekassa.com/";
    const params = new URLSearchParams({
      m: String(merchant),
      oa: String(amount),
      o: String(orderId),
      s: sign,
      currency,
      lang: "ru",
    });

    // в экстра-параметрах передадим userId
    params.set("us_uid", String(userId));

    const url = `${base}?${params.toString()}`;

    return NextResponse.json({ ok: true, id: dep.id, url });
  } catch (err: any) {
    console.error("invoice error", err);
    return NextResponse.json({ ok: false, error: err?.message || "internal" }, { status: 500 });
  }
}