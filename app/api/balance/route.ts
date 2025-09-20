import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { getBalance } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = readUidFromCookies(req);
  if (!uid) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

  const balance = await getBalance(uid);
  return NextResponse.json({ ok: true, balance });
}