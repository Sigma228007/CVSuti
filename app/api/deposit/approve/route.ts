import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { approveDeposit, declineDeposit, getDeposit } from "@/lib/store";
import { notifyUserDepositApproved, notifyUserDepositDeclined } from "@/lib/notify"; // если нет — закомментируй

type TgUser = { id: number };

function verifyInitData(initData: string, botToken: string): { ok: boolean; user?: TgUser } {
  try {
    const p = new URLSearchParams(initData);
    const hash = p.get("hash") || ""; p.delete("hash");
    const s = Array.from(p.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");
    const k = crypto.createHmac("sha256","WebAppData").update(botToken).digest();
    const h = crypto.createHmac("sha256",k).update(s).digest("hex");
    if (h!==hash) return { ok:false };
    const u = p.get("user"); if (!u) return { ok:false };
    return { ok:true, user: JSON.parse(u) as TgUser };
  } catch { return { ok:false }; }
}

function isAdmin(userId: number): boolean {
  const admins = (process.env.ADMIN_IDS || process.env.NEXT_PUBLIC_ADMIN_IDS || "")
    .split(",").map(s=>Number(s.trim())).filter(Boolean);
  return admins.includes(userId);
}

// POST (из UI)
export async function POST(req: NextRequest) {
  const { initData, requestId, action } = (await req.json()) as {
    initData?: string; requestId?: string; action?: "approve"|"decline";
  };

  if (!process.env.BOT_TOKEN) return NextResponse.json({ ok:false, error:"BOT_TOKEN missing" },{status:500});
  const v = verifyInitData(initData||"", process.env.BOT_TOKEN);
  if (!v.ok || !v.user || !isAdmin(v.user.id)) return NextResponse.json({ ok:false, error:"forbidden" },{status:403});
  if (!requestId || !action) return NextResponse.json({ ok:false, error:"bad_payload" },{status:400});

  const dep = await getDeposit(requestId);
  if (!dep || dep.status!=="pending") return NextResponse.json({ ok:false, error:"not_found_or_not_pending" },{status:400});

  if (action === "approve") {
    const res = await approveDeposit(requestId);
    try { await notifyUserDepositApproved({ userId: dep.userId, amount: dep.amount }); } catch {}
    return NextResponse.json({ ok:true, status: res?.status });
  } else {
    const res = await declineDeposit(requestId);
    try { await notifyUserDepositDeclined({ userId: dep.userId, amount: dep.amount }); } catch {}
    return NextResponse.json({ ok:true, status: res?.status });
  }
}

// GET (старые ссылки из Telegram: ?id=..&action=approve|decline)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";
  const action = (searchParams.get("action") || "").toLowerCase();

  if (!id || !["approve","decline"].includes(action)) {
    return NextResponse.json({ ok:false, error:"bad_params" },{status:400});
  }

  const dep = await getDeposit(id);
  if (!dep || dep.status!=="pending") return NextResponse.json({ ok:false, error:"not_found_or_not_pending" },{status:400});

  if (action === "approve") {
    await approveDeposit(id);
    try { await notifyUserDepositApproved({ userId: dep.userId, amount: dep.amount }); } catch {}
  } else {
    await declineDeposit(id);
    try { await notifyUserDepositDeclined({ userId: dep.userId, amount: dep.amount }); } catch {}
  }
  // простая страница-ответ
  return new Response(
    `<html><body style="font-family:sans-serif;padding:24px">
      <h2>Заявка ${action==='approve'?'подтверждена':'отклонена'}</h2>
      <div>ID: ${id}</div>
      <div>User: ${dep.userId}</div>
      <div>Amount: ${dep.amount}₽</div>
    </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}