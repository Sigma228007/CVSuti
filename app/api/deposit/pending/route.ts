import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getPendingForUser } from "@/lib/deposits";

export async function GET(req: NextRequest) {
  try {
    const initData = req.headers.get("x-telegram-init-data") || "";
    const parsed = verifyInitData(initData, process.env.BOT_TOKEN!);
    if (!parsed?.user?.id) return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });

    const list = getPendingForUser(parsed.user.id);
    return NextResponse.json({ ok: true, items: list });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "error" }, { status: 500 });
  }
}