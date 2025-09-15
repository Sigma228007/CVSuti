import { NextResponse } from "next/server";
import { publicCommit } from "@/lib/fair";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.SERVER_SEED) {
    return NextResponse.json({ ok: false, error: "SERVER_SEED missing" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, commit: publicCommit(process.env.SERVER_SEED) });
}