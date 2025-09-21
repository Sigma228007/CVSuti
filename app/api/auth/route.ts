import { NextRequest, NextResponse } from "next/server";
import {
  isTelegramLike,
  readUidFromCookies,
  setUidCookie,
  extractInitDataSources,
} from "@/lib/session";
import { ensureUser, getBalance } from "@/lib/store";

// максимально мягкая авторизация: берём uid откуда угодно,
// ставим куку, создаём пользователя (если нужно) — и готово.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { initData?: string; uid?: number };

export async function POST(req: NextRequest) {
  try {
    const cookieUid = readUidFromCookies(req);

    const { initData, uid: bodyUid } = (await req.json().catch(() => ({}))) as Body;
    const { headerInitData, headerUid, queryInitData } = extractInitDataSources(req);

    // кандидаты на initData и uid
    const allInitData = [initData, headerInitData, queryInitData].filter(Boolean) as string[];
    const maybeUid = [
      bodyUid,
      Number(headerUid || "0") || null,
      cookieUid,
    ].find((v) => Number.isFinite(v as number)) as number | null;

    let uid: number | null = maybeUid ?? null;

    // пробуем достать uid из initDataUnsafe (без падений, без верификации)
    if (!uid) {
      for (const raw of allInitData) {
        try {
          const parsed = new URLSearchParams(raw);
          const userStr = parsed.get("user");
          if (userStr) {
            const u = JSON.parse(userStr);
            if (u?.id && Number.isFinite(Number(u.id))) {
              uid = Number(u.id);
              break;
            }
          }
        } catch {}
      }
    }

    // если ещё нет — но это явно Telegram, даём гостевой uid (стабильный по IP+UA)
    if (!uid && isTelegramLike(req)) {
      // слабая «стабильность» под один запуск клиента
      const ip = req.headers.get("x-forwarded-for") || "0.0.0.0";
      const ua = req.headers.get("user-agent") || "tg";
      uid = Math.abs(
        Array.from((ip + ua).slice(0, 24)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      ) + 10_000_000; // чтобы не пересекаться с реальными uid
    }

    if (!uid) {
      return NextResponse.json({ ok: false, error: "no initData/uid" }, { status: 400 });
    }

    // зафиксировали куку
    const res = NextResponse.json({ ok: true, uid });
    setUidCookie(res, uid);

    // создаём/обновляем юзера
    await ensureUser({ id: uid });

    // можно сразу вернуть баланс
    const balance = await getBalance(uid);
    (res as any).json = async () => ({ ok: true, uid, balance }); // (для некоторых рантаймов)

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "auth failed" }, { status: 500 });
  }
}