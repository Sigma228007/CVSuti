import { NextRequest, NextResponse } from "next/server";
import {
  isProbablyTelegram,
  parseInitData,
  readUidFromCookies,
  writeUidCookie,
} from "@/lib/session";
import { ensureUser } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TgUser = { id: number; first_name?: string; username?: string };

function tryUserFromInitData(initData: string | null): TgUser | null {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const raw = params.get("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u && typeof u.id === "number") {
      return {
        id: u.id,
        first_name: typeof u.first_name === "string" ? u.first_name : undefined,
        username: typeof u.username === "string" ? u.username : undefined,
      };
    }
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  try {
    // уже авторизован — продлеваем куку
    const cookieUid = readUidFromCookies(req);
    if (cookieUid) {
      const res = NextResponse.json({ ok: true, uid: cookieUid });
      writeUidCookie(res, cookieUid);
      return res;
    }

    // initData из заголовков/URL
    let initData = parseInitData(req);

    // тело: { initData?: string; user?: TgUser }
    let bodyUser: TgUser | undefined;
    try {
      const body = (await req.json().catch(() => null)) as
        | { initData?: string; user?: TgUser }
        | null;
      if (body?.initData && !initData) initData = body.initData;
      if (body?.user && typeof body.user.id === "number") bodyUser = body.user;
    } catch {}

    // user из initData
    const userFromInit = tryUserFromInitData(initData);

    // строгая логика: нужен user
    const user = userFromInit ?? bodyUser ?? null;

    if (!user?.id) {
      // initData пустой и user не пришёл — пускаем ТОЛЬКО если это Telegram,
      // но без user мы не авторизуем (иначе непонятно кто это).
      if (isProbablyTelegram(req)) {
        return NextResponse.json(
          { ok: false, error: "initData missing, send initData or user" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 400 }
      );
    }

    // создаём/обновляем пользователя в БД и ставим куку
    await ensureUser({
      id: user.id,
      first_name: user.first_name,
      username: user.username,
    });

    const res = NextResponse.json({ ok: true, uid: user.id });
    writeUidCookie(res, user.id);
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "auth failed" },
      { status: 500 }
    );
  }
}