import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies } from "@/lib/session";
import { getDeposit, declineDeposit } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(uid: number | null) {
  const ids = (process.env.ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);
  return uid != null && ids.includes(uid);
}

/** Отклонение депозита админом. */
export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!isAdmin(uid)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });

    const dep = await getDeposit(id);
    if (!dep) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

    if (dep.status === "pending") {
      await declineDeposit(dep);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "decline failed" }, { status: 500 });
  }
}