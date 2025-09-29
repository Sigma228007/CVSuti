import { NextRequest, NextResponse } from "next/server";
import { readUidFromCookies, isAdmin } from "@/lib/session";
import { getDeposit, approveDeposit } from "@/lib/store";
import { notifyUserDepositApproved } from "@/lib/notify";
import { verifyAdminSignature } from "@/lib/sign";
import type { Deposit } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApprovalResult = {
  ok: boolean;
  depositStatus: Deposit["status"];
  message?: string;
  error?: string;
};

async function processApproval(dep: Deposit): Promise<ApprovalResult> {
  if (dep.status === "approved") {
    return {
      ok: true,
      depositStatus: "approved",
      message: "Пополнение уже подтверждено",
    };
  }

  if (dep.status === "declined") {
    return {
      ok: false,
      depositStatus: "declined",
      error: "Заявка уже отклонена",
    };
  }

  await approveDeposit(dep);

  try {
    await notifyUserDepositApproved(dep);
  } catch (notifyError) {
    console.error("Deposit approval notification error:", notifyError);
  }

  return {
    ok: true,
    depositStatus: dep.status,
    message: "Пополнение подтверждено",
  };
}

function buildResponse(result: ApprovalResult, extra?: Record<string, unknown>) {
  const status = result.ok ? 200 : 400;
  return NextResponse.json({ ...result, ...extra }, { status });
}

async function approveById(id: string, sig?: string | null) {
  const dep = await getDeposit(id);
  if (!dep) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  if (sig && !verifyAdminSignature({ id: dep.id }, sig)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  const approval = await processApproval(dep);
  return buildResponse(approval);
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

    const approval = await processApproval(dep);
    return buildResponse(approval, { redirect: "/admin" });
  } catch (e: any) {
    console.error("Deposit approve error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
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

    return approveById(body.id, body.sig);
  } catch (e: any) {
    console.error("Deposit approve error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}