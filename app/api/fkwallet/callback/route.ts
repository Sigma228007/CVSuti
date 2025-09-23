import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDeposit, approveDeposit, declineDeposit, addBalance } from "@/lib/store";
import { notifyUserDepositApproved, notifyUserDepositDeclined } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// FK секреты
const S1 = process.env.FK_SECRET_1 || "";
const S2 = process.env.FK_SECRET_2 || "";
const MERCHANT = process.env.FK_MERCHANT_ID || "";

function md5(s: string) {
  return crypto.createHash("md5").update(s).digest("hex");
}

function checkSign(params: Record<string, string | undefined>, secret: string) {
  const sign = (params["SIGN"] || params["sign"] || "").toLowerCase();
  
  if (params["AMOUNT"] && secret === S1) {
    const base = `${MERCHANT}:${params["AMOUNT"]}:${S1}:${params["MERCHANT_ORDER_ID"]}`;
    return md5(base) === sign;
  }
  
  if (!params["AMOUNT"] && secret === S2) {
    const base = `${MERCHANT}:${params["MERCHANT_ORDER_ID"]}:${S2}`;
    return md5(base) === sign;
  }
  
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    form.forEach((v, k) => (params[k] = String(v)));

    console.log('FreeKassa callback received:', params);

    const orderId = params["MERCHANT_ORDER_ID"];
    if (!orderId) {
      console.error('No order ID in callback');
      return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });
    }

    const dep = await getDeposit(orderId);
    if (!dep) {
      console.error('Deposit not found:', orderId);
      return NextResponse.json({ ok: false, error: "dep not found" }, { status: 404 });
    }

    // Если пришёл успех
    if (params["AMOUNT"]) {
      if (!checkSign(params, S1)) {
        console.error('Invalid signature for success callback');
        return NextResponse.json({ ok: false, error: "bad sign" }, { status: 403 });
      }
      
      if (dep.status !== "approved") {
        console.log('Approving deposit:', dep.id, 'for user:', dep.userId, 'amount:', dep.amount);
        
        await approveDeposit(dep);
        await addBalance(dep.userId, dep.amount);
        
        console.log('Deposit approved successfully');

        // Уведомление пользователю
        try {
          await notifyUserDepositApproved(dep);
          console.log('User notification sent');
        } catch (notifyError) {
          console.error('Deposit approved notification error:', notifyError);
        }
      } else {
        console.log('Deposit already approved');
      }
      
      return NextResponse.json({ ok: true });
    }

    // Иначе считаем это фейлом
    if (!checkSign(params, S2)) {
      console.error('Invalid signature for failure callback');
      return NextResponse.json({ ok: false, error: "bad sign" }, { status: 403 });
    }
    
    if (dep.status === "pending") {
      console.log('Declining deposit:', dep.id);
      await declineDeposit(dep);
      
      // Уведомление пользователю
      try {
        await notifyUserDepositDeclined(dep);
      } catch (notifyError) {
        console.error('Deposit declined notification error:', notifyError);
      }
    }
    
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Callback error:', e);
    return NextResponse.json({ ok: false, error: e?.message || "callback failed" }, { status: 500 });
  }
}