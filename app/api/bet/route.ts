import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { roll, publicCommit } from "@/lib/fair";
import {
  HOUSE_EDGE_BP,
  MIN_CHANCE,
  MAX_CHANCE,
  MIN_BET,
  MAX_BET,
} from "@/lib/config";
import {
  getBalance,
  setBalance,
  getNonce,
  incNonce,
  writeBet,
  type BetRecord,
} from "@/lib/store";

// для верификации initData телеги (если у тебя есть)
import { verifyInitData } from "@/lib/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TgUser = {
  id: number;
  first_name?: string;
  username?: string;
};

function verifyInitDataOrThrow(initData?: string) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) throw new Error("BOT_TOKEN is not set");
  const v = verifyInitData(initData ?? "", botToken);
  if (!v.ok || !v.user) throw new Error("unauthorized");
  return v.user as TgUser;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const initData: string | undefined = body?.initData;
    const user = verifyInitDataOrThrow(initData);
    const userId = Number(user.id);

    const amount = Number(body?.amount ?? 0);
    const chance = Number(body?.chance ?? 0);

    if (
      !Number.isFinite(amount) ||
      !Number.isFinite(chance) ||
      amount < MIN_BET ||
      amount > MAX_BET ||
      chance < MIN_CHANCE ||
      chance > MAX_CHANCE
    ) {
      return NextResponse.json({ error: "bad params" }, { status: 400 });
    }

    // баланс
    const bal = await getBalance(userId);
    if (bal < amount) {
      return NextResponse.json(
        { error: "not enough balance" },
        { status: 400 }
      );
    }

    // nonce #1 (для fair.roll)
    const nonce1 = await getNonce(userId);

    // fair
    const serverSeed = process.env.SERVER_SEED!;
    const clientSeed = `${userId}:${nonce1}`;
    const commit = publicCommit(serverSeed);
    const r = roll(serverSeed, clientSeed, nonce1);
    const rolled = r.value; // 0..9999

    const win = rolled < Math.round(chance * 100);

    const rawPayout = Math.floor((amount * 100) / Math.max(chance, 1e-9));
    const payout = Math.floor((rawPayout * (10000 - HOUSE_EDGE_BP)) / 10000);

    // пересчёт баланса
    let newBal = bal - amount;
    let won = 0;
    if (win) {
      won = payout;
      newBal += won;
    }

    await setBalance(userId, newBal);

    // nonce #2 — инкремент после ставки
    const nonce2 = await incNonce(userId);

    // запись ставки
    const bet: BetRecord = {
      id: `bet_${Date.now()}_${userId}`,
      userId,
      amount,
      chance,
      result: win ? "win" : "lose",
      payout: won,
      roll: rolled,
      commit,
      nonce: nonce2,
      createdAt: Date.now(),
    };
    await writeBet(bet);

    return NextResponse.json({
      ok: true,
      result: bet.result,
      balance: newBal,
      payout: won,
      roll: rolled,
      commit,
      nonce: nonce2,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "bet failed" },
      { status: 500 }
    );
  }
}