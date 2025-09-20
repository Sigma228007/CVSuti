import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { publicCommit, roll } from "@/lib/fair"; // ВАЖНО: используем ваше API fair
import {
  HOUSE_EDGE_BP,
  MIN_BET,
  MAX_BET,
  MIN_CHANCE,
  MAX_CHANCE,
} from "@/lib/config";
import { verifyInitData } from "@/lib/sign";
import {
  getBalance,
  setBalance,
  getNonce,
  incNonce,      // <— теперь есть
  writeBet,      // <— теперь есть
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TgUser = { id: number; first_name?: string; username?: string };

function parseInitData(initData: string): { ok: boolean; user?: TgUser } {
  try {
    if (!verifyInitData(initData, process.env.BOT_TOKEN!)) return { ok: false };
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) return { ok: false };
    return { ok: true, user: JSON.parse(userStr) as TgUser };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      initData?: string;
      amount: number;
      chance: number;
    };

    if (!body.initData) {
      return NextResponse.json({ error: "no initData" }, { status: 401 });
    }
    const auth = parseInitData(body.initData);
    if (!auth.ok || !auth.user) {
      return NextResponse.json({ error: "bad auth" }, { status: 401 });
    }
    const userId = auth.user.id;

    const amount = Number(body.amount || 0);
    const chance = Number(body.chance || 0);

    if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) {
      return NextResponse.json(
        { error: "bad amount", min: MIN_BET, max: MAX_BET },
        { status: 400 },
      );
    }
    if (!Number.isFinite(chance) || chance < MIN_CHANCE || chance > MAX_CHANCE) {
      return NextResponse.json(
        { error: "bad chance", min: MIN_CHANCE, max: MAX_CHANCE },
        { status: 400 },
      );
    }

    const bal = await getBalance(userId);
    if (bal < amount) {
      return NextResponse.json({ error: "not enough balance" }, { status: 400 });
    }
    const nonce = await getNonce(userId);

    // fair: у вас roll(serverSeed, clientSeed, nonce) -> { value, hex }
    const serverSeed = process.env.SERVER_SEED!;
    const clientSeed = `${userId}:${nonce}`;
    const commit = publicCommit(serverSeed); // ← требовал 1 аргумент
    const r = roll(serverSeed, clientSeed, nonce);
    const rolled = r.value; // ← число 0..9999

    const win = rolled < Math.round(chance * 100);

    const rawPayout = Math.floor((amount * 100) / Math.max(chance, 1e-9));
    const payout = Math.floor((rawPayout * (10000 - HOUSE_EDGE_BP)) / 10000);

    let newBal = bal - amount;
    let won = 0;
    if (win) {
      won = payout;
      newBal += won;
    }

    await setBalance(userId, newBal);
    await incNonce(userId, 1);

    // лог ставки в хранилище
    await writeBet({
      id: `bet_${Date.now()}_${userId}`,
      userId,
      amount,
      chance,
      result: win ? "win" : "lose",
      payout: won,
      roll: rolled,
      commit,
      nonce,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      result: win ? "win" : "lose",
      balance: newBal,
      roll: rolled,
      payout: won,
      commit,
      nonce,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "bet failed" }, { status: 500 });
  }
}