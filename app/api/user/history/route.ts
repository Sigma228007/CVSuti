import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getUserHistory } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken) return NextResponse.json({ ok:false, error:"BOT_TOKEN missing" }, { status:500 });

    const { initData, limit } = (await req.json()) as { initData?: string; limit?: number };
    if (!initData) return NextResponse.json({ ok:false, error:"no initData" }, { status:401 });

    const v = verifyInitData(initData, botToken);
    if (!v.ok || !v.user?.id) return NextResponse.json({ ok:false, error:"unauthorized" }, { status:401 });

    const hist = await getUserHistory(v.user.id, Number(limit||50));
    return NextResponse.json({ ok:true, ...hist });
  } catch {
    return NextResponse.json({ ok:false, error:"server_error" }, { status:500 });
  }
}