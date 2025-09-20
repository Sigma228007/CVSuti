import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getBalance,
  addBalance,
  getNonce,
  incNonce,
  pushBet,
  type BetRecord,
} from "@/lib/store";
import {
  HOUSE_EDGE_BP,
  MIN_CHANCE,
  MAX_CHANCE,
  MIN_BET,
  MAX_BET,
} from "@/lib/config";
import { verifyInitData } from "@/lib/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  initData?: string;
  amount?: number;
  chance?: number;
  dir?: "more" | "less";
};

function publicCommit(serverSeed: string) {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
}

function roll(serverSeed: string, clientSeed: string, nonce: number) {
  const data = `${serverSeed}:${clientSeed}:${nonce}`;
  const h = crypto.createHash("sha256").update(data).digest("hex");
  const v = parseInt(h.slice(0, 8), 16);
  const value = v % 10000; // 0..9999
  return { value, hex: h };
}

export async function POST(req: NextRequest) {
  try {
    const body: Body = await req.json();

    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
    }
    if (!body.initData) {
      return NextResponse.json({ ok: false, error: "no initData" }, { status: 400 });
    }

    const v = verifyInitData(body.initData, botToken);
    if (!v.ok || !v.user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const userId = Number(v.user.id);

    const amount = Math.floor(Number(body.amount || 0));
    const chance = Math.max(MIN_CHANCE, Math.min(MAX_CHANCE, Math.floor(Number(body.chance || 0))));
    if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) {
      return NextResponse.json({ ok: false, error: "bad amount" }, { status: 400 });
    }
    if (!Number.isFinite(chance)) {
      return NextResponse.json({ ok: false, error: "bad chance" }, { status: 400 });
    }

    const bal = await getBalance(userId);
    if (bal < amount) {
      return NextResponse.json({ ok: false, error: "not enough balance" }, { status: 400 });
    }

    const serverSeed = process.env.SERVER_SEED || "server_seed";
    const nonce = await incNonce(userId);
    const clientSeed = `${userId}:${nonce}`;
    const commit = publicCommit(serverSeed);
    const r = roll(serverSeed, clientSeed, nonce);

    const rolled = r.value; // 0..9999
    const win = rolled < Math.round(chance * 100);

    const rawPayout = Math.floor((amount * 100) / Math.max(chance, 1));
    const payout = Math.floor((rawPayout * (10000 - HOUSE_EDGE_BP)) / 10000);

    await addBalance(userId, -amount);
    let won = 0;
    if (win) {
      won = payout;
      await addBalance(userId, won);
    }

    const bet: BetRecord = {
      id: `bet_${Date.now()}_${userId}`,
      userId,
      amount,
      payout: won,
      rolled,
      createdAt: Date.now(),
    };
    await pushBet(userId, bet);

    return NextResponse.json({
      ok: true,
      result: win ? "win" : "lose",
      chance,
      rolled,
      payout: won,
      nonce,
      commit,
      balanceDelta: win ? won - amount : -amount,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "bet failed" }, { status: 500 });
  }
}