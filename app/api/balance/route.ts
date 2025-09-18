import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/sign";
import { getBalance } from "@/lib/store";

async function extractInitData(req: NextRequest): Promise<string> {
  const url = new URL(req.url);
  const q = url.searchParams.get("initData");
  if (q) return q;
  const hdr = req.headers.get("x-init-data");
  if (hdr) return hdr;
  if (req.method !== "GET") {
    try {
      const body = await req.json();
      if (body?.initData) return String(body.initData);
    } catch {}
  }
  return "";
}

async function handler(req: NextRequest) {
  const initData = await extractInitData(req);
  const botToken = process.env.BOT_TOKEN || "";
  if (!initData || !botToken) {
    return NextResponse.json({ ok: false, error: "no initData" }, { status: 401 });
  }

  const v = verifyInitData(initData, botToken);
  if (!("ok" in v) || !v.ok) {
    return NextResponse.json({ ok: false, error: "bad initData" }, { status: 401 });
  }

  const balance = await getBalance(v.user.id);
  return NextResponse.json({ ok: true, balance });
}

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }