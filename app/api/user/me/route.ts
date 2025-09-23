import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getBalance, ensureUser } from "@/lib/store";

type TgUser = { id: number; first_name?: string; username?: string };

function extractUser(x: unknown): TgUser | null {
  if (!x || typeof x !== "object") return null;
  
  if ("ok" in (x as any)) {
    const obj = x as { ok: boolean; user?: TgUser };
    return obj.ok && obj.user ? obj.user : null;
  }
  
  if ("user" in (x as any)) {
    const obj = x as { user?: TgUser };
    return obj.user ?? null;
  }
  
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { initData } = (await req.json()) as { initData?: string };
    const botToken = process.env.BOT_TOKEN!;
    
    if (!botToken) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
    }
    
    if (!initData) {
      return NextResponse.json({ ok: false, error: "no initData" }, { status: 401 });
    }

    const parsed = verifyInitData(initData, botToken);
    const user = extractUser(parsed);
    
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // Обновляем данные пользователя
    await ensureUser({
      id: user.id,
      first_name: user.first_name,
      username: user.username
    });

    const balance = await getBalance(user.id);
    
    return NextResponse.json({ 
      ok: true, 
      user, 
      balance,
      requireTelegram: false 
    });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}