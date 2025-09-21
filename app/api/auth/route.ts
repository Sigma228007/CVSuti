import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { ensureUser, getBalance } from "@/lib/store";
import { writeSession } from "@/lib/session";

type Body = {
  initData?: string;
  demo?: boolean;
  uid?: number;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
    }

    const body: Body = await req.json().catch(() => ({}));

    let userId: number | null = null;

    // 1) Telegram initData
    if (body.initData) {
      const v = verifyInitData(body.initData, botToken);
      if (!v.ok || !v.user) {
        return NextResponse.json({ ok: false, error: "bad initData" }, { status: 401 });
      }
      userId = Number(v.user.id);
      await ensureUser({
        id: userId,
        first_name: v.user.first_name ?? undefined,
        username: v.user.username ?? undefined,
      });
    }

    // 2) Опционально — демо-вход (включается явным параметром demo)
    if (!userId && body.demo && body.uid) {
      userId = Number(body.uid);
      await ensureUser({ id: userId });
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: "no initData" }, { status: 400 });
    }

    const resp = NextResponse.json({
      ok: true,
      user: { id: userId },
      balance: await getBalance(userId),
    });
    await writeSession(resp, userId);
    return resp;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "auth failed" }, { status: 500 });
  }
}