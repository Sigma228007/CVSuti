import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { redis } from "@/lib/redis";
import { addBalance } from "@/lib/store"; // у тебя есть addBalance(uid, delta)

export async function POST(req: NextRequest) {
  try {
    // FK шлет либо form-urlencoded, либо query
    const url = new URL(req.url);
    const q = url.searchParams;

    // универсально достанем поля
    // m - merchant id, oa - amount, o - order id, s - sign
    const merchant = q.get("m") || "";
    const amountStr = q.get("oa") || "";
    const orderId = q.get("o") || "";
    const s = (q.get("s") || "").toLowerCase();

    if (!merchant || !amountStr || !orderId || !s) {
      return new NextResponse("NO", { status: 400 });
    }

    const secret2 = process.env.FK_SECRET_2 || "";
    if (!secret2) return new NextResponse("NO", { status: 500 });

    // подпись результата: md5(`${merchant}:${amount}:${secret2}:${orderId}`)
    const calc = crypto
      .createHash("md5")
      .update(`${merchant}:${amountStr}:${secret2}:${orderId}`)
      .digest("hex");

    if (calc !== s) {
      return new NextResponse("NO", { status: 403 });
    }

    // проверим заказ
    const c = await redis();
    const saved = await c.hGetAll(`fk:order:${orderId}`);
    if (!saved || !saved.uid || !saved.amount) {
      // двойные нотификации? уже обработано
      return new NextResponse("YES"); // FK ожидает "YES"
    }

    const uid = Number(saved.uid);
    const amt = Math.floor(Number(saved.amount));
    if (amt > 0 && Number.isFinite(uid)) {
      await addBalance(uid, amt);
    }

    // пометим как обработанный
    await c.del(`fk:order:${orderId}`);

    return new NextResponse("YES"); // FK считает успешным только буквальный "YES"
  } catch (e) {
    console.error("FK callback error:", e);
    return new NextResponse("NO", { status: 500 });
  }
}

// На всякий случай поддержим и GET (иногда так настраивают)
export const GET = POST;