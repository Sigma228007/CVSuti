import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getBalance, upsertUser } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { initData?: string };

export async function POST(req: NextRequest) {
  try {
    const { initData }: Body = await req.json();

    const botToken =
      process.env.BOT_TOKEN || process.env.NEXT_PUBLIC_BOT_TOKEN || "";
    const v = verifyInitData(initData || "", botToken);
    if (!v.ok || !v.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const uid = Number(v.user.id);

    // сохраним/обновим карточку пользователя
    await upsertUser({
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
      { error: e?.message || "auth failed" },
      { status: 500 }
    );
  }
}