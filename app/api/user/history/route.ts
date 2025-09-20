export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getUserHistory } from "@/lib/store";

export async function GET(req: NextRequest) {
  try {
    // initData берём из заголовка (как у тебя на фронте fetchBalance/fetchJson)
    const initData =
      req.headers.get("x-init-data") ||
      req.headers.get("X-Init-Data") ||
      req.nextUrl.searchParams.get("initData") ||
      "";

    const botToken = process.env.BOT_TOKEN || "";
    const v = verifyInitData(initData, botToken);
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const userId = v.user.id;
    const hist = await getUserHistory(userId, 10);

    return NextResponse.json({ ok: true, ...hist }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server_error" },
      { status: 500 }
    );
  }
}