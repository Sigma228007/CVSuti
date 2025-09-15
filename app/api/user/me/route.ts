import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getBalance } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    const botToken = process.env.BOT_TOKEN!;
    const parsed = verifyInitData(initData, botToken); // { user: {...} } либо null

    if (!parsed?.user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const userId = Number(parsed.user.id);
    const balance = getBalance(userId) ?? 0;

    return NextResponse.json({
      ok: true,
      user: { id: userId, first_name: parsed.user.first_name, username: parsed.user.username },
      balance,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
  }
}