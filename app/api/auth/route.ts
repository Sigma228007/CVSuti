import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getBalance, ensureUser } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { initData?: string };

export async function POST(req: NextRequest) {
  try {
    const { initData }: Body = await req.json();

    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken) {
      return NextResponse.json(
        { ok: false, error: "BOT_TOKEN missing" },
        { status: 500 }
      );
    }

    if (!initData) {
      return NextResponse.json(
        { ok: false, error: "no initData" },
        { status: 400 }
      );
    }

    const v = verifyInitData(initData, botToken);
    if (!v.ok || !v.user) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const uid = Number(v.user.id);

    // создаём/обновляем пользователя (баланс не трогаем)
    await ensureUser({
      id: uid,
      first_name: v.user.first_name ?? "",
      username: v.user.username ?? "",
    });

    const balance = await getBalance(uid);

    return NextResponse.json({
      ok: true,
      user: {
        id: uid,
        first_name: v.user.first_name ?? "",
        username: v.user.username ?? "",
      },
      balance,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "auth failed" },
      { status: 500 }
    );
  }
}