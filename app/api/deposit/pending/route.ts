import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { listPending } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { initData } = (await req.json()) as { initData?: string };

    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
    }
    if (!initData) {
      return NextResponse.json({ ok: false, error: "no initData" }, { status: 401 });
    }

    const parsed = verifyInitData(initData, botToken);
    if (!("ok" in parsed) || !parsed.ok) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // проверка админа
    const uid = parsed.user.id;
    const admins = (process.env.ADMIN_IDS || process.env.NEXT_PUBLIC_ADMIN_IDS || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter(Boolean);
    if (!admins.includes(uid)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const pending = await listPending(50);
    return NextResponse.json({ ok: true, pending });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}