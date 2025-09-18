import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getBalance } from "@/lib/store";

type TgUser = { id: number };

function verify(initData: string, botToken: string): number | null {
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
    if (myHash !== hash) return null;

    const userStr = params.get("user");
    if (!userStr) return null;

    const user = JSON.parse(userStr) as TgUser;
    return user.id;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const BOT_TOKEN = process.env.BOT_TOKEN || "";
  const initData = req.nextUrl.searchParams.get("initData") || "";

  const uid = verify(initData, BOT_TOKEN);
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const balance = await getBalance(uid);
  return NextResponse.json({ ok: true, balance });
}