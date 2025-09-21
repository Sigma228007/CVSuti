import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getBalance } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sess = await requireSession(req);
  if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const balance = await getBalance(sess.userId);
  return NextResponse.json({ ok: true, userId: sess.userId, balance });
}