import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getPendingForUser } from "@/lib/deposits";

export async function POST(req: NextRequest) {
  try {
    const { initData } = (await req.json()) as { initData?: string };

    const botToken = process.env.BOT_TOKEN!;
    const parsed = verifyInitData(initData || "", botToken);
    if (!parsed || !parsed.user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const pending = getPendingForUser(Number(parsed.user.id));
    return NextResponse.json({ ok: true, pending });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}