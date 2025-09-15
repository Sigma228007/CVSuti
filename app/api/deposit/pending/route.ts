import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getPendingForUser } from "@/lib/deposits";

export async function POST(req: NextRequest) {
  const { initData } = (await req.json()) as { initData: string };
  const parsed = verifyInitData(initData, process.env.BOT_TOKEN!);
  const userId = Number(parsed?.user?.id);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const list = getPendingForUser(userId);
  return NextResponse.json({ ok: true, pending: list });
}