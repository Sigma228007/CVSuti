import { NextRequest, NextResponse } from 'next/server'
import { declineDeposit } from '@/lib/deposits'
import { notifyUserDepositDeclined } from '@/lib/notify'
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

    const dep = declineDeposit(id)
    if (!dep) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    }

    if (dep.status === 'declined') {
      await notifyUserDepositDeclined(dep)
    }

    return NextResponse.json({ ok: true, dep })
  } catch {
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 })
  }
}