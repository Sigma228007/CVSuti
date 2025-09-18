import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getBalance } from "@/lib/store";

// Небольшая валидация initData по тем же правилам, что и в /api/bet
type TgUser = { id: number; first_name?: string; username?: string };

function verifyInitData(initData: string, botToken: string): { ok: boolean; user?: TgUser } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const myHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (myHash !== hash) return { ok: false };
    const userStr = params.get("user");
    if (!userStr) return { ok: false };
    const user = JSON.parse(userStr) as TgUser;
    return { ok: true, user };
  } catch {
    return { ok: false };
  }
}

// Универсальный обработчик, чтобы поддержать и GET, и POST
async function handle(req: NextRequest) {
  try {
    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
    }

    // initData принимаем из хэдера / query / body
    let initData =
      req.headers.get("x-init-data") ||
      new URL(req.url).searchParams.get("initData") ||
      "";

    if (!initData && req.method === "POST") {
      try {
        const body = await req.json();
        initData = body?.initData || "";
      } catch {
        // пустое тело — ок
      }
    }

    if (!initData) {
      return NextResponse.json({ ok: false, error: "no initData" }, { status: 401 });
    }

    const v = verifyInitData(initData, botToken);
    if (!v.ok || !v.user) {
      return NextResponse.json({ ok: false, error: "bad initData" }, { status: 401 });
    }

    const userId = v.user.id;
    const balance = await getBalance(userId);

    return NextResponse.json(
      { ok: true, balance },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}