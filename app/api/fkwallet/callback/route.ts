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
    const calculatedSign = md5(base);
    console.log('Signature check - Base:', base);
    console.log('Signature check - Expected:', sign);
    console.log('Signature check - Calculated:', calculatedSign);
    return calculatedSign === sign;
  }
  
  if (!params["AMOUNT"] && secret === S2) {
    const base = `${MERCHANT}:${params["MERCHANT_ORDER_ID"]}:${S2}`;
    const calculatedSign = md5(base);
    console.log('Signature check (fail) - Base:', base);
    console.log('Signature check (fail) - Expected:', sign);
    console.log('Signature check (fail) - Calculated:', calculatedSign);
    return calculatedSign === sign;
  }
  
  return false;
}

export async function POST(req: NextRequest) {
  console.log('=== FREEKASSA CALLBACK START ===');
  
  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    form.forEach((v, k) => (params[k] = String(v)));

    console.log('Full callback data:');
    console.log('URL:', req.url);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    console.log('Form data received:', JSON.stringify(params, null, 2));

    const orderId = params["MERCHANT_ORDER_ID"];
    if (!orderId) {
      console.error('❌ No order ID in callback');
      console.log('=== FREEKASSA CALLBACK END (ERROR) ===');
      return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });
    }

    console.log('🔍 Looking for deposit:', orderId);
    const dep = await getDeposit(orderId);
    
    if (!dep) {
      console.error('❌ Deposit not found:', orderId);
      console.log('=== FREEKASSA CALLBACK END (ERROR) ===');
      return NextResponse.json({ ok: false, error: "dep not found" }, { status: 404 });
    }

    console.log('✅ Deposit found:', {
      id: dep.id,
      userId: dep.userId,
      amount: dep.amount,
      status: dep.status,
      provider: dep.provider
    });

    // Если пришёл успех
    if (params["AMOUNT"]) {
      console.log('💰 Success callback detected');
      console.log('Amount from FK:', params["AMOUNT"]);
      console.log('Amount expected:', dep.amount);
      
      if (!checkSign(params, S1)) {
        console.error('❌ Invalid signature for success callback');
        console.log('=== FREEKASSA CALLBACK END (ERROR) ===');
        return NextResponse.json({ ok: false, error: "bad sign" }, { status: 403 });
      }

      console.log('✅ Signature verified successfully');
      
      if (dep.status !== "approved") {
        console.log('🔄 Approving deposit:', dep.id, 'for user:', dep.userId, 'amount:', dep.amount);
        
        try {
          await approveDeposit(dep);
          console.log('✅ Deposit approved in database');
          
          await addBalance(dep.userId, dep.amount);
          console.log('✅ Balance updated for user:', dep.userId);
          
          // Проверяем что баланс обновился
          const { getBalance } = await import("@/lib/store");
          const newBalance = await getBalance(dep.userId);
          console.log('✅ New balance for user', dep.userId, ':', newBalance);

          // Уведомление пользователю
          try {
            await notifyUserDepositApproved(dep);
            console.log('✅ User notification sent');
          } catch (notifyError) {
            console.error('❌ Deposit approved notification error:', notifyError);
          }
        } catch (storeError) {
          console.error('❌ Error in store operations:', storeError);
          throw storeError;
        }
      } else {
        console.log('ℹ️ Deposit already approved');
      }
      
      console.log('=== FREEKASSA CALLBACK END (SUCCESS) ===');
      return NextResponse.json({ ok: true, message: "deposit approved" });
    }

    // Иначе считаем это фейлом
    console.log('❌ Failure callback detected');
    
    if (!checkSign(params, S2)) {
      console.error('❌ Invalid signature for failure callback');
      console.log('=== FREEKASSA CALLBACK END (ERROR) ===');
      return NextResponse.json({ ok: false, error: "bad sign" }, { status: 403 });
    }
    
    if (dep.status === "pending") {
      console.log('🔄 Declining deposit:', dep.id);
      await declineDeposit(dep);
      
      // Уведомление пользователю
      try {
        await notifyUserDepositDeclined(dep);
        console.log('✅ Decline notification sent');
      } catch (notifyError) {
        console.error('❌ Deposit declined notification error:', notifyError);
      }
    }
    
    console.log('=== FREEKASSA CALLBACK END (DECLINED) ===');
    return NextResponse.json({ ok: true, message: "deposit declined" });
    
  } catch (e: any) {
    console.error('💥 CALLBACK ERROR:', e);
    console.log('=== FREEKASSA CALLBACK END (EXCEPTION) ===');
    return NextResponse.json({ 
      ok: false, 
      error: e?.message || "callback failed",
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }, { status: 500 });
  }
}