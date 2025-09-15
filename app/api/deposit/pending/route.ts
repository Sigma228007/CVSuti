import { NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
// Поставьте свои реальные имена:
import { getPendingForUser /*, getAllPending или как у вас */ } from "@/lib/deposits";

export async function POST(req: Request) {
  try {
    const { initData } = await req.json();
    const botToken = process.env.BOT_TOKEN!;
    const v = verifyInitData(String(initData || ""), botToken);
    if (!v || !v.user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const me = v.user.id;
    const admins = String(process.env.ADMIN_IDS || "")
      .split(",")
      .map(s => Number(s.trim()))
      .filter(Boolean);
    const isAdmin = admins.includes(me);

    // если у вас, например, функция называется getAllPending:
    const pending = isAdmin ? /* getAllPending() */ getPendingForUser(me) : getPendingForUser(me);

    return NextResponse.json({ ok: true, pending });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}