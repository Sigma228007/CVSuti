import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getBalance, upsertUser } from "@/lib/store";

type Body = { initData?: string };

export async function POST(req: NextRequest) {
  try {
    const { initData }: Body = await req.json();

    const botToken = process.env.BOT_TOKEN || "";
    if (!initData || !botToken) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const parsed = verifyInitData(initData, botToken);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const user = parsed.user!;
    const uid = user.id;

    // апсертим профиль (строго без null — только undefined)
    await upsertUser(uid, {
      id: uid,
      first_name: user.first_name ?? undefined,
      username:   user.username   ?? undefined,
      lastSeenAt: Date.now(),
    });

    const balance = await getBalance(uid);
    return NextResponse.json({ ok: true, userId: uid, balance });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}