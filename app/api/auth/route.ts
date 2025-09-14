import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };

function verifyInitData(initData: string, botToken: string): { ok: boolean; user?: TgUser } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    params.delete("hash");

    // data_check_string: ключи по алфавиту, "key=value" через \n
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    // secret_key = HMAC_SHA256(key="WebAppData", data=botToken)
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();

    // myHash = HMAC_SHA256(data_check_string, secret_key) в hex
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

export async function POST(req: NextRequest) {
  const { initData } = (await req.json()) as { initData?: string };

  // Дев-режим: если нет токена — вернём заглушку, чтобы билд проходил
  if (!process.env.BOT_TOKEN) {
    const demoUser: TgUser = { id: 1, first_name: "Demo" };
    return NextResponse.json({ ok: true, user: demoUser });
  }

  if (!initData) {
    return NextResponse.json({ ok: false, error: "no initData" }, { status: 400 });
  }

  const result = verifyInitData(initData, process.env.BOT_TOKEN!);
  if (!result.ok || !result.user) {
    return NextResponse.json({ ok: false, error: "bad initData" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user: result.user });
}