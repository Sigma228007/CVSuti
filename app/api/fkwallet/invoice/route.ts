import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createDepositRequest } from "@/lib/store";

type TgUser = { id: number };
function verifyInitData(initData: string, botToken: string): { ok: boolean; user?: TgUser } {
  try {
    const p = new URLSearchParams(initData);
    const hash = p.get("hash") || "";
    p.delete("hash");
    const s = Array.from(p.entries())
      .sort(([a, b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const k = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const h = crypto.createHmac("sha256", k).update(s).digest("hex");
    if (h !== hash) return { ok: false };
    const u = p.get("user");
    if (!u) return { ok: false };
    return { ok: true, user: JSON.parse(u) as TgUser };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest) {
  const { initData, amount } = (await req.json()) as { initData?: string; amount?: number };
  if (!process.env.BOT_TOKEN) return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });

  const v = verifyInitData(initData || "", process.env.BOT_TOKEN);
  if (!v.ok || !v.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const mId = process.env.FK_MERCHANT_ID;
  const s1 = process.env.FK_SECRET_1;
  if (!mId || !s1) return NextResponse.json({ ok: false, error: "FreeKassa not configured" }, { status: 500 });

  const amt = Math.floor(Number(amount || 0));
  if (!amt || amt < 1) return NextResponse.json({ ok: false, error: "bad amount" }, { status: 400 });

  // создаём локальную заявку (pending) — используем её id как order_id в FK
  const dep = await createDepositRequest(v.user.id, amt);

  // формируем подпись для FK (классический формат):
  // sign = md5(m_id:amount:secret1:currency:order_id)
  const currency = "RUB";
  const raw = `${mId}:${amt}:${s1}:${currency}:${dep.id}`;
  const sign = crypto.createHash("md5").update(raw).digest("hex");

  const url = `https://pay.freekassa.com/?m=${encodeURIComponent(
    mId
  )}&oa=${amt}&o=${encodeURIComponent(dep.id)}&currency=${currency}&sign=${sign}`;

  return NextResponse.json({ ok: true, url });
}