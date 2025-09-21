import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies, isTelegramLike } from "@/lib/session";
import { getBalance } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = readUidFromCookies(req);

  if (!uid) {
    // в dev может не быть куки — но если это Telegram-подобный агент, не роняем UI
    if (!isTelegramLike(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    // «пустой» ответ, чтобы фронт не падал
    return NextResponse.json({ ok: true, balance: 0, uid: null });
  }

  const balance = await getBalance(uid);
  return NextResponse.json({ ok: true, uid, balance });
}