import { NextRequest, NextResponse } from 'next/server';
import { roll, publicCommit } from '@/lib/fair';
import { HOUSE_EDGE_BP, MIN_BET, MAX_BET, MIN_CHANCE, MAX_CHANCE } from '@/lib/config';
import { bets, getBalance, setBalance, getNonce, type BetRecord } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function coefForChance(chancePct: number) {
  const edge = (10000 - HOUSE_EDGE_BP) / 10000;
  const fair = 100 / chancePct;
  return +(fair * edge).toFixed(4);
}

export async function POST(req: NextRequest) {
  try {
    const { userId, amount, chance, dir } = await req.json() as {
      userId: number; amount: number; chance: number; dir: 'over' | 'under';
    };

    if (!userId) return NextResponse.json({ ok: false, error: 'no user' }, { status: 400 });
    if (typeof amount !== 'number' || amount < MIN_BET || amount > MAX_BET)
      return NextResponse.json({ ok: false, error: 'bad amount' }, { status: 400 });
    if (typeof chance !== 'number' || chance < MIN_CHANCE || chance > MAX_CHANCE)
      return NextResponse.json({ ok: false, error: 'bad chance' }, { status: 400 });
    if (dir !== 'over' && dir !== 'under')
      return NextResponse.json({ ok: false, error: 'bad dir' }, { status: 400 });

    const balance = getBalance(userId);
    if (amount > balance) return NextResponse.json({ ok: false, error: 'insufficient' }, { status: 400 });

    const serverSeed = process.env.SERVER_SEED || '';
    if (!serverSeed) return NextResponse.json({ ok: false, error: 'SERVER_SEED is missing' }, { status: 500 });

    const clientSeed = String(userId);
    const nonce = getNonce(userId);
    const { value, hex } = roll(serverSeed, clientSeed, nonce);

    const threshold = Math.floor(chance * 10_000);
    const win = dir === 'under' ? value < threshold : value >= (1_000_000 - threshold);

    const coef = coefForChance(chance);
    const payout = win ? Math.floor(amount * coef) : 0;

    const after = balance - amount + payout;
    setBalance(userId, after);

    const rec: BetRecord = {
      id: `${Date.now()}_${userId}_${nonce}`,
      userId, amount, chance, dir, placedAt: Date.now(), nonce,
      outcome: {
        value, win, payout, coef,
        proof: { serverSeedHash: publicCommit(serverSeed), serverSeed, clientSeed, hex },
      }
    };
    bets.unshift(rec);

    return NextResponse.json({ ok: true, balance: after, bet: rec });
  } catch (e: any) {
    console.error('BET ERROR', e?.message || e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}