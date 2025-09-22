import { NextRequest, NextResponse } from "next/server";
import { extractUserFromInitData, writeUidCookie, readUidFromCookies, isProbablyTelegram } from "@/lib/session";
import { verifyInitData } from "@/lib/sign";
import { ensureUser, getBalance } from "@/lib/store";

export const runtime = "nodejs";

type Body = { initData?: string };

/** POST: { initData } - try to authenticate and set uid cookie */
/** GET: read cookie and return uid+balance if present */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const initData = (body && body.initData) || req.headers.get("x-init-data") || undefined;

    // 1) If initData present — try to extract user (prefer verified)
    if (initData) {
      // attempt verification if possible (we don't strictly require it here; try best-effort)
      let parsed = extractUserFromInitData(initData, process.env.BOT_TOKEN);
      if (!parsed.ok) {
        // As extra fallback, attempt verifyInitData directly (some formats)
        try {
          const v = verifyInitData(initData, process.env.BOT_TOKEN || "");
          if (v.ok) {
            parsed = { ok: true as const, id: v.user.id, user: v.user, verified: true as const };
          }
        } catch {
          // ignore
        }
      }

      if (parsed.ok) {
        const uid = parsed.id;
        // ensure user record and return balance
        try { await ensureUser({ id: uid, first_name: parsed.user?.first_name, username: parsed.user?.username }); } catch {}
        const bal = await getBalance(uid);
        const res = NextResponse.json({ ok: true, uid, balance: bal });
        writeUidCookie(res, uid);
        return res;
      }

      return NextResponse.json({ ok: false, error: "cannot parse initData" }, { status: 400 });
    }

    // 2) If no initData but cookie present — return uid
    const cookieUid = readUidFromCookies(req);
    if (cookieUid) {
      const bal = await getBalance(cookieUid);
      return NextResponse.json({ ok: true, uid: cookieUid, balance: bal });
    }

    // 3) If request probably from Telegram (heuristic), but no initData — allow "soft" login? We'll instruct client to provide initData.
    if (isProbablyTelegram(req)) {
      return NextResponse.json({ ok: false, error: "no initData provided — please open mini-app via bot" }, { status: 401 });
    }

    // 4) default: unauthorized
    return NextResponse.json({ ok: false, error: "no initData" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookieUid = readUidFromCookies(req);
    if (!cookieUid) {
      return NextResponse.json({ ok: false, error: "no uid" }, { status: 401 });
    }
    const bal = await getBalance(cookieUid);
    return NextResponse.json({ ok: true, uid: cookieUid, balance: bal });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}