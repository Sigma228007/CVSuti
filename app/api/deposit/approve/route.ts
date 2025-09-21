import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies, isAdmin } from "@/lib/session";
import { getDeposit, approveDeposit, addBalance } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const uid = await readUidFromCookies(req);
    if (!isAdmin(uid)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });

    const dep = await getDeposit(id);
    if (!dep) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

    await approveDeposit(dep);
    await addBalance(dep.userId, dep.amount);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}