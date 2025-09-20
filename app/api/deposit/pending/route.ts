import { listPendingDeposits } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listPendingDeposits(100);
  return Response.json({ ok: true, items });
}