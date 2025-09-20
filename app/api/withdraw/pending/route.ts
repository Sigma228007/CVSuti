import { listPendingWithdrawals } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listPendingWithdrawals(100);
  return Response.json({ ok: true, items });
}