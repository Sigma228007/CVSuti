import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createDepositRequest } from "@/lib/store";
import { notifyDepositAdmin } from "@/lib/notify"; // если нет — закомментируй

type TgUser = { id: number; first_name?: string; username?: string };

function verifyInitData(initData: string, botToken: string): { ok: boolean; user?: TgUser } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    params.delete("hash");
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const myHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    if (myHash !== hash) return { ok: false };
    const u = params.get("user"); if (!u) return { ok: false };
    return { ok: true, user: JSON.parse(u) as TgUser };
  } catch { return { ok: false }; }
}

export async function POST(req: NextRequest) {
  const { initData, amount } = (await req.json()) as { initData?: string; amount?: number };
  if (!process.env.BOT_TOKEN) return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
  if (!initData || !amount || amount < 1) return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });

  const v = verifyInitData(initData, process.env.BOT_TOKEN);
  if (!v.ok || !v.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const dep = await createDepositRequest(v.user.id, amount);
  // уведомление админу с кнопками (если у тебя есть lib/notify.ts)
  try { await notifyDepositAdmin({ id: dep.id, userId: dep.userId, amount: dep.amount }); } catch {}
  return NextResponse.json({ ok: true, id: dep.id });
}