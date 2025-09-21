import { NextRequest, NextResponse } from "next/server";
import { ensureUser, getBalance } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Телеграм-ли это? (очень мягкая эвристика) */
function looksLikeTelegram(req: NextRequest) {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const ref = (req.headers.get("referer") || "").toLowerCase();
  return (
    ua.includes("telegram") ||
    ua.includes("tginternal") ||
    ref.includes("t.me") ||
    ref.includes("telegram.org")
  );
}

/** Универсальное извлечение initData из запроса */
async function extractInitData(req: NextRequest): Promise<string> {
  // 1) заголовок X-Init-Data (то, что шлём с клиента)
  const h = req.headers.get("x-init-data");
  if (h && h.length > 10) return h;

  // 2) query-параметры
  const sp = req.nextUrl.searchParams;
  const fromQuery =
    sp.get("tgWebAppData") ||
    sp.get("initData") ||
    sp.get("initdata") ||
    sp.get("init_data");
  if (fromQuery && fromQuery.length > 10) return fromQuery;

  // 3) тело (JSON)
  try {
    const cloned = req.clone();
    const body = (await cloned.json().catch(() => null)) as
      | { initData?: string }
      | null;
    if (body?.initData && body.initData.length > 10) return body.initData;
  } catch {}

  // 4) Authorization (на всякий)
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().includes("tg")) {
    return auth.replace(/^Tg\s+/i, "").trim();
  }

  // 5) куки (мы сами кладём их при успешной авторизации)
  const cookieStored = req.cookies.get("tg_init_data")?.value;
  if (cookieStored && cookieStored.length > 10) return cookieStored;

  return "";
}

/** Достаём user из initData (формат query-строки: ...&user=<JSON>&...) */
function extractUserFromInitData(initData: string): {
  id?: number;
  first_name?: string;
  username?: string;
} | null {
  if (!initData) return null;
  try {
    const sp = new URLSearchParams(initData);
    const userRaw = sp.get("user");
    if (!userRaw) return null;
    const u = JSON.parse(userRaw);
    const idNum =
      typeof u?.id === "number" ? u.id : Number.parseInt(String(u?.id || ""), 10);
    if (!Number.isFinite(idNum)) return null;
    return {
      id: idNum,
      first_name: u?.first_name,
      username: u?.username,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 0) Пробуем достать initData и user
    const initData = await extractInitData(req);
    const fromInit = extractUserFromInitData(initData);

    // 1) Пытаемся взять uid из initData → иначе из cookie → иначе из debug параметра
    const sp = req.nextUrl.searchParams;
    const cookieUid = req.cookies.get("uid")?.value;
    const debugUid = sp.get("debug_uid") || sp.get("uid");

    let uid: number | null = null;
    let first_name: string | undefined;
    let username: string | undefined;

    if (fromInit?.id) {
      uid = fromInit.id;
      first_name = fromInit.first_name;
      username = fromInit.username;
    } else if (cookieUid && Number.isFinite(Number(cookieUid))) {
      uid = Number(cookieUid);
    } else if (looksLikeTelegram(req) && debugUid && Number.isFinite(Number(debugUid))) {
      // режим «пусть войдёт любой, если похоже на Телеграм» — полезно для теста на девайсе
      uid = Number(debugUid);
    }

    if (!uid) {
      // Ничего убедительного — считаем, что не авторизован.
      return NextResponse.json(
        { ok: false, error: "open_via_telegram" },
        { status: 400 }
      );
    }

    // 2) Создаём/обновляем пользователя, баланс и пр.
    await ensureUser({ id: uid, first_name, username });
    const balance = await getBalance(uid);

    // 3) Ставим куки (uid и tg_init_data) чтобы не просить initData на каждом шаге
    const res = NextResponse.json({
      ok: true,
      uid,
      balance,
    });

    // uid живёт долго
    res.cookies.set("uid", String(uid), {
      httpOnly: false,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // год
    });

    // initData можно положить тоже (если есть) — пригодится на серверных ручках
    if (initData) {
      res.cookies.set("tg_init_data", initData, {
        httpOnly: false,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // месяц
      });
    }

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "auth_failed" },
      { status: 500 }
    );
  }
}

// Дополнительно: быстрый GET, чтобы фронт мог «пинговаться» и убеждаться, что авторизован.
export async function GET(req: NextRequest) {
  try {
    const uidCookie = req.cookies.get("uid")?.value;
    if (!uidCookie) {
      return NextResponse.json({ ok: false, error: "no_uid" }, { status: 401 });
    }
    const uid = Number(uidCookie);
    if (!Number.isFinite(uid)) {
      return NextResponse.json({ ok: false, error: "bad_uid" }, { status: 401 });
    }
    const balance = await getBalance(uid);
    return NextResponse.json({ ok: true, uid, balance });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "auth_failed" },
      { status: 500 }
    );
  }
}