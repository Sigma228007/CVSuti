import { NextRequest, NextResponse } from 'next/server'
import { approveDeposit, getDepositById } from '@/lib/deposits'
import { addBalance } from '@/lib/store'
import { notifyUserDepositApproved } from '@/lib/notify'
import { verifyAdminSig } from '@/lib/sign'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || ''
    const sig = searchParams.get('sig') || ''

    const key = process.env.ADMIN_SIGN_KEY || ''
    if (!id || !sig || !key || !verifyAdminSig(id, sig, key)) {
      return NextResponse.json({ ok: false, error: 'bad signature' }, { status: 400 })
    }

    const dep = approveDeposit(id)
    if (!dep) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    }

    // Защита от повторов: баланс зачисляем только если был pending
    if (dep.status === 'approved') {
      addBalance(dep.userId, dep.amount)
      await notifyUserDepositApproved(dep)
    }

    return NextResponse.json({ ok: true, dep })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 })
  }
}