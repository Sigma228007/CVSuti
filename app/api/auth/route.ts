import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };

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
    const userStr = params.get("user");
    if (!userStr) return { ok: false };
    const user = JSON.parse(userStr) as TgUser;
    return { ok: true, user };
  } catch {
    return { ok: false };
  }
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { initData } = (await req.json()) as { initData?: string };

  if (!process.env.BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
  }
  if (!initData) {
    return NextResponse.json({ ok: false, error: "no initData" }, { status: 401 });
  }

  const res = verifyInitData(initData, process.env.BOT_TOKEN);
  if (!res.ok || !res.user) {
    return NextResponse.json({ ok: false, error: "bad initData" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, user: res.user });
}