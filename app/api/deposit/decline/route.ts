import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies, isAdmin } from "@/lib/session";
import { getDeposit, declineDeposit } from "@/lib/store";
import { notifyUserDepositDeclined } from "@/lib/notify";
import { verifyAdminSignature } from "@/lib/sign";
import type { Deposit } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeclineResult = {
  ok: boolean;
  depositStatus: Deposit["status"];
  message?: string;
  error?: string;
};

async function processDecline(dep: Deposit): Promise<DeclineResult> {
  if (dep.status === "declined") {
    return {
      ok: true,
      depositStatus: "declined",
      message: "Заявка уже отклонена",
    };
  }

  if (dep.status === "approved") {
    return {
      ok: false,
      depositStatus: "approved",
      error: "Пополнение уже подтверждено",
    };
  }

  await declineDeposit(dep);

  try {
    await notifyUserDepositDeclined(dep);
  } catch (notifyError) {
    console.error("Deposit decline notification error:", notifyError);
  }

  return {
    ok: true,
    depositStatus: dep.status,
    message: "Пополнение отклонено",
  };
}

function buildResponse(result: DeclineResult, extra?: Record<string, unknown>) {
  const status = result.ok ? 200 : 400;
  return NextResponse.json({ ...result, ...extra }, { status });
}

async function declineById(id: string, sig?: string | null) {
  const dep = await getDeposit(id);
  if (!dep) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  if (sig && !verifyAdminSignature({ id: dep.id }, sig)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  const result = await processDecline(dep);
  return buildResponse(result);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const sig = url.searchParams.get("sig");

    if (!id || !sig) {
      return NextResponse.json({ ok: false, error: "Missing parameters" }, { status: 400 });
    }

    const dep = await getDeposit(id);
    if (!dep) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }

    if (!verifyAdminSignature({ id: dep.id }, sig)) {
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
    }

    const result = await processDecline(dep);
    return buildResponse(result, { redirect: "/admin" });
  } catch (e: any) {
    console.error("Deposit decline error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "decline failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = readUidFromCookies(req);
    if (!isAdmin(uid)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { id?: string; sig?: string };
    if (!body.id) {
      return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });
    }

    return declineById(body.id, body.sig);
  } catch (e: any) {
    console.error("Deposit decline error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "decline failed" }, { status: 500 });
  }
}