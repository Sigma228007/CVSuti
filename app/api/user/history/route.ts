import { NextRequest } from "next/server";
import { getUserHistory } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const uid = Number(url.searchParams.get("userId") || 0);
  const limit = Number(url.searchParams.get("limit") || 50);
  if (!uid) return Response.json({ ok: false, error: "no userId" }, { status: 400 });

  const data = await getUserHistory(uid, limit);
  return Response.json({ ok: true, ...data });
}