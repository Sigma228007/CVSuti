import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { addBalance } from "@/lib/store";

/**
 * Универсальная проверка подписи
 * Поддерживает 2 формата: "id:user:amount" и JSON.stringify({...})
 */
function verifySig({
  id,
  userId,
  amount,
  sig,
  key,
}: {
  id: string;
  userId: number;
  amount: number;
  sig?: string | null;
  key: string;
}) {
  if (!sig) return false;

  const h1 = crypto
    .createHmac("sha256", key)
    .update(`${id}:${userId}:${amount}`)
    .digest("hex");

  const h2 = crypto
    .createHmac("sha256", key)
    .update(JSON.stringify({ id, userId, amount }))
    .digest("hex");

  return sig === h1 || sig === h2;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") || "";
    const user = Number(url.searchParams.get("user") || "0");
    const amount = Number(url.searchParams.get("amount") || "0");
    const sig = url.searchParams.get("sig");

    if (!id || !user || !amount) {
      return NextResponse.json(
        { ok: false, error: "bad_params" },
        { status: 400 }
      );
    }

    const key = process.env.ADMIN_SIGN_KEY || "";
    if (key) {
      const ok = verifySig({ id, userId: user, amount, sig, key });
      if (!ok) {
        return NextResponse.json(
          { ok: false, error: "unauthorized" },
          { status: 401 }
        );
      }
    }

    // ✅ Зачисление средств
    await addBalance(user, amount);

    return NextResponse.json({ ok: true, credited: amount, user });
  } catch (e) {
    console.error("approve error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}