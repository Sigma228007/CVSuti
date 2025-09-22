import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies, writeUidCookie, isProbablyTelegram, extractUserFromInitData } from "@/lib/session";
import { ensureUser, getBalance } from "@/lib/store";

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.NEXT_PUBLIC_BOT_TOKEN || "";

/**
 * Try many places to find initData / telegram user id.
 */
function findInitDataOrId(req: NextRequest): { initData?: string; headerId?: number } {
  // 1) query params
  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    if (q.get("initData")) return { initData: q.get("initData") || undefined };
    if (q.get("tgWebAppData")) return { initData: q.get("tgWebAppData") || undefined };
  } catch (e) {
    // ignore
  }

  // 2) headers (several common names)
  const h = (name: string) => {
    const v = req.headers.get(name);
    return v ? v : null;
  };

  const fromHeader = h("x-init-data") || h("x-telegram-initdata") || h("x-tg-initdata") || h("x-tg-webapp-data");
  if (fromHeader) return { initData: fromHeader };

  // telegram may send bot api user id header
  const headerId = h("x-telegram-bot-api-user-id") || h("x-telegram-user-id") || h("x-telegram-id");
  if (headerId && /^\d+$/.test(headerId)) return { headerId: Number(headerId) };

  // 3) cookie tgInitData fallback
  try {
    const tg = req.cookies.get("tgInitData");
    if (tg && tg.value) return { initData: tg.value };
  } catch {}

  return {};
}

async function readBodyInitData(req: NextRequest): Promise<string | undefined> {
  try {
    // Try JSON body
    const ctype = req.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      if (body && body.initData) return String(body.initData);
    } else {
      // try formData (e.g., JS post of form)
      const fd = await req.formData().catch(() => null);
      if (fd) {
        const v = fd.get("initData");
        if (v) return String(v);
      }
    }
  } catch (e) {
    // ignore parse errors
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    // 0) if we already have uid cookie -> return it immediately
    const cookieUid = readUidFromCookies(req);
    if (cookieUid) {
      const balance = await getBalance(cookieUid);
      return NextResponse.json({ ok: true, uid: cookieUid, balance });
    }

    // 1) try body initData
    const bodyInit = await readBodyInitData(req);
    if (bodyInit) {
      const parsed = extractUserFromInitData(bodyInit, BOT_TOKEN || undefined);
      if (parsed.ok && parsed.id) {
        const uid = Number(parsed.id);
        // ensure user record
        await ensureUser({ id: uid, first_name: parsed.user?.first_name, username: parsed.user?.username });
        const res = NextResponse.json({ ok: true, uid });
        writeUidCookie(res, uid);
        const balance = await getBalance(uid);
        return NextResponse.json({ ok: true, uid, balance });
      }
      // if parse failed — still return helpful error
      return NextResponse.json({ ok: false, error: "bad initData (body)" }, { status: 400 });
    }

    // 2) try many other places: query, headers, cookies
    const found = findInitDataOrId(req);
    if (found.initData) {
      const parsed = extractUserFromInitData(found.initData, BOT_TOKEN || undefined);
      if (parsed.ok && parsed.id) {
        const uid = Number(parsed.id);
        await ensureUser({ id: uid, first_name: parsed.user?.first_name, username: parsed.user?.username });
        const res = NextResponse.json({ ok: true, uid });
        writeUidCookie(res, uid);
        const balance = await getBalance(uid);
        return NextResponse.json({ ok: true, uid, balance });
      } else {
        return NextResponse.json({ ok: false, error: "bad initData (query/header/cookie)" }, { status: 400 });
      }
    }

    if (found.headerId) {
      const uid = Number(found.headerId);
      await ensureUser({ id: uid });
      const res = NextResponse.json({ ok: true, uid });
      writeUidCookie(res, uid);
      const balance = await getBalance(uid);
      return NextResponse.json({ ok: true, uid, balance });
    }

    // 3) if nothing — but request *looks like* coming from Telegram (heuristic), try to accept
    if (isProbablyTelegram(req)) {
      // If we can't extract id but the request appears to be Telegram, respond with explicit error,
      // but include hint. We DO NOT create random uid here to avoid balance mismatch.
      return NextResponse.json({ ok: false, error: "no initData; request seems Telegram but no id found. Try passing initData or ensure tg sends x-telegram-bot-api-user-id header." }, { status: 400 });
    }

    // 4) fallback: no auth found
    return NextResponse.json({ ok: false, error: "no initData" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

/** Also expose GET for quick debug (reads query initData or existing cookie) */
export async function GET(req: NextRequest) {
  try {
    const cookieUid = readUidFromCookies(req);
    if (cookieUid) {
      const balance = await getBalance(cookieUid);
      return NextResponse.json({ ok: true, uid: cookieUid, balance });
    }

    const url = new URL(req.url);
    const initData = url.searchParams.get("initData") || url.searchParams.get("tgWebAppData") || undefined;
    if (initData) {
      const parsed = extractUserFromInitData(initData, BOT_TOKEN || undefined);
      if (parsed.ok && parsed.id) {
        const uid = Number(parsed.id);
        await ensureUser({ id: uid, first_name: parsed.user?.first_name, username: parsed.user?.username });
        const res = NextResponse.json({ ok: true, uid });
        writeUidCookie(res, uid);
        const balance = await getBalance(uid);
        return NextResponse.json({ ok: true, uid, balance });
      } else {
        return NextResponse.json({ ok: false, error: "bad initData (query)" }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: false, error: "no initData" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}