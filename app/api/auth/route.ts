import { NextRequest, NextResponse } from "next/server";
import {
  isTelegramLike,
  readUidFromCookies,
  setUidCookie,
  extractInitDataSources,
  makeGuestUid,
} from "@/lib/session";
import { ensureUser, getBalance } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { initData?: string; uid?: number };

export async function POST(req: NextRequest) {
  try {
    // 1) если uid уже есть в куке — готово
    const cookieUid = readUidFromCookies(req);
    if (cookieUid) {
      const res = NextResponse.json({ ok: true, uid: cookieUid, balance: await getBalance(cookieUid) });
      setUidCookie(res, cookieUid);
      return res;
    }

    // 2) собираем initData из всех источников + возможный uid
    const { initData, uid: bodyUid } = (await req.json().catch(() => ({}))) as Body;
    const { headerInitData } = extractInitDataSources(req);
    let uid: number | null = bodyUid ?? null;

    // 3) парсим initDataUnsafe (без падений)
    const tryParse = (raw?: string | null) => {
      if (!raw) return;
      try {
        const p = new URLSearchParams(raw);
        const uStr = p.get("user");
        if (uStr) {
          const u = JSON.parse(uStr);
          if (u?.id && Number.isFinite(Number(u.id))) uid = Number(u.id);
        }
      } catch {}
    };
    tryParse(initData);
    tryParse(headerInitData);

    // 4) если это телеграм-вебвью, но id так и не нашли — выдаём гостевой
    if (!uid && isTelegramLike(req)) {
      uid = makeGuestUid(req);
    }

    // 5) если и это не помогло — не пускаем (обычный браузер)
    if (!uid) return NextResponse.json({ ok: false, error: "no initData/uid" }, { status: 400 });

    // 6) выставляем куку, создаём пользователя (если его ещё нет)
    const res = NextResponse.json({ ok: true, uid, balance: await getBalance(uid) });
    setUidCookie(res, uid);
    await ensureUser({ id: uid });

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "auth failed" }, { status: 500 });
  }
}