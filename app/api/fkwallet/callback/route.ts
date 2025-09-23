import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDeposit, approveDeposit, declineDeposit, addBalance } from "@/lib/store";
import { notifyUserDepositApproved, notifyUserDepositDeclined } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MERCHANT_ID = process.env.FK_MERCHANT_ID || "";
const SECRET_WORD_2 = process.env.FK_SECRET_2 || "";

function generateSignature(merchantId: string, amount: string, secret: string, orderId: string): string {
  return crypto
    .createHash("md5")
    .update(`${merchantId}:${amount}:${secret}:${orderId}`)
    .digest("hex")
    .toLowerCase();
}

export async function POST(req: NextRequest) {
  console.log('=== FREEKASSA CALLBACK START ===');
  
  try {
    const formData = await req.formData();
    const params: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    console.log('Callback params:', JSON.stringify(params, null, 2));

    const {
      MERCHANT_ORDER_ID: orderId,
      AMOUNT: amount,
      SIGN: receivedSign
    } = params;

    if (!orderId || !amount || !receivedSign) {
      console.error('❌ Missing required parameters');
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const expectedSign = generateSignature(MERCHANT_ID, amount, SECRET_WORD_2, orderId);
    
    console.log('Signature verification:', {
      received: receivedSign.toLowerCase(),
      expected: expectedSign,
      match: receivedSign.toLowerCase() === expectedSign
    });

    if (receivedSign.toLowerCase() !== expectedSign) {
      console.error('❌ Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    console.log('🔍 Looking for deposit:', orderId);
    const deposit = await getDeposit(orderId);
    
    if (!deposit) {
      console.error('❌ Deposit not found:', orderId);
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    console.log('✅ Deposit found:', {
      id: deposit.id,
      userId: deposit.userId,
      amount: deposit.amount,
      status: deposit.status
    });

    if (deposit.status !== "pending") {
      console.log('ℹ️ Deposit already processed:', deposit.status);
      return new Response("YES");
    }

    const amountNum = parseFloat(amount);
    if (Math.abs(amountNum - deposit.amount) > 0.01) {
      console.error('❌ Amount mismatch:', { received: amountNum, expected: deposit.amount });
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    console.log('🔄 Approving deposit automatically...');
    await approveDeposit(deposit);
    await addBalance(deposit.userId, deposit.amount);
    
    console.log('✅ Deposit approved and balance updated');

    try {
      await notifyUserDepositApproved(deposit);
      console.log('✅ User notified');
    } catch (notifyError) {
      console.error('❌ Notification error:', notifyError);
    }

    console.log('=== FREEKASSA CALLBACK END (SUCCESS) ===');
    return new Response("YES");
    
  } catch (error: any) {
    console.error('💥 CALLBACK ERROR:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}