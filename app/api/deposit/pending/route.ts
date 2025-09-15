import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getPendingForUser } from "@/lib/deposits";

export async function POST(req: NextRequest) {
  const { initData } = await req.json() as { initData: string };
  const botToken = process.env.BOT_TOKEN!;
  const parsed = verifyInitData(initData, botToken);
  if (!parsed?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const pending = getPendingForUser(Number(parsed.user.id));
  return NextResponse.json({ ok: true, pending });
}