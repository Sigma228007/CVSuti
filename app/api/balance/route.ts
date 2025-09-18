import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getBalance } from "@/lib/store";

type TgUser = { id: number };
function verify(initData: string, botToken: string): { ok: boolean; user?: TgUser } {
  try {
    const p = new URLSearchParams(initData);
    const hash = p.get("hash") || ""; p.delete("hash");
    const s = Array.from(p.entries()).sort(([a,b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");
    const k = crypto.createHmac("sha256","WebAppData").update(botToken).digest();
    const h = crypto.createHmac("sha256",k).update(s).digest("hex");
    if (h!==hash) return {ok:false};
    const u = p.get("user"); if (!u) return {ok:false};
    return {ok:true, user: JSON.parse(u) as TgUser};
  } catch { return {ok:false}; }
}

export async function GET(req: NextRequest) {
  if (!process.env.BOT_TOKEN) return NextResponse.json({ ok:false, error:"BOT_TOKEN missing" },{status:500});
  const initData = req.nextUrl.searchParams.get("initData") || "";
  const v = verify(initData, process.env.BOT_TOKEN);
  if (!v.ok || !v.user) return NextResponse.json({ ok:false, error:"unauthorized" },{status:401});
  const bal = await getBalance(v.user.id);
  return NextResponse.json({ ok:true, balance: bal });
}