import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { roll, publicCommit } from "@/lib/fair";
import {
  HOUSE_EDGE_BP,
  MIN_BET,
  MAX_BET,
  MIN_CHANCE,
  MAX_CHANCE,
} from "@/lib/config";
import {
  getBalance,
  setBalance,
  getNonce,
  incNonce,
  writeBet,
  type BetRecord,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TgUser = { id: number; first_name?: string; username?: string };

function verifyInitData(
  initData: string,
  botToken: string
): { ok: boolean; user?: TgUser } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();
    const myHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (myHash !== hash) return { ok: false };
    const userStr = params.get("user");
    if (!userStr) return { ok: false };
    const user = JSON.parse(userStr) as TgUser;
    return { ok: true, user };
  } catch {
    return { ok: false };
  }
}

function coefForChance(chancePct: number) {
  const edge = (10000 - HOUSE_EDGE_BP) / 10000;
  const fair = 100 / chancePct;
  return +(fair * edge).toFixed(4);
}

export async function POST(req: NextRequest) {
  const { initData, amount, chance, dir } = (await req.json()) as {
    initData?: string;
    amount: number;
    chance: number;
    dir: "over" | "under";
  };

  if (!process.env.BOT_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "BOT_TOKEN missing" },
      { status: 500 }
    );
  }
  if (!initData) {
    return NextResponse.json(
      { ok: false, error: "no initData" },
      { status: 401 }
    );
  }

  const v = verifyInitData(initData, process.env.BOT_TOKEN);
  if (!v.ok || !v.user) {
    return NextResponse.json(
      { ok: false, error: "bad initData" },
      { status: 401 }
    );
  }
  const userId = v.user.id;

  // валидации
  if (typeof amount !== "number" || amount < MIN_BET || amount > MAX_BET) {
    return NextResponse.json(
      { ok: false, error: "bad amount" },
      { status: 400 }
    );
  }
  if (
    typeof chance !== "number" ||
    chance < MIN_CHANCE ||
    chance > MAX_CHANCE
  ) {
    return NextResponse.json(
      { ok: false, error: "bad chance" },
      { status: 400 }
    );
  }
  if (dir !== "over" && dir !== "under") {
    return NextResponse.json(
      { ok: false, error: "bad dir" },
      { status: 400 }
    );
  }

  const balance = await getBalance(userId);
  if (amount > balance) {
    return NextResponse.json(
      { ok: false, error: "insufficient" },
      { status: 400 }
    );
  }

  const serverSeed = process.env.SERVER_SEED || "";
  if (!serverSeed) {
    return NextResponse.json(
      { ok: false, error: "SERVER_SEED missing" },
      { status: 500 }
    );
  }

  const clientSeed = String(userId);
  const currentNonce = await getNonce(userId);
  const nextNonce = await incNonce(userId, 1);
  const { value, hex } = roll(serverSeed, clientSeed, nextNonce);

  // 1% = 10_000 из 1_000_000
  const threshold = Math.floor(chance * 10_000);
  const win =
    dir === "under"
      ? value < threshold
      : value >= 1_000_000 - threshold;

  const coef = coefForChance(chance);
  const payout = win ? Math.floor(amount * coef) : 0;
  const after = balance - amount + payout;

  await setBalance(userId, after);

  const commit = {
    serverSeedHash: publicCommit(serverSeed),
    serverSeed,
    clientSeed,
    hex,
  };

  const bet: BetRecord = {
    id: `bet_${Date.now()}_${userId}_${nextNonce}`,
    userId,
    amount,
    chance,
    result: win ? "win" : "lose",
    payout,
    roll: value,
    commit,
    nonce: nextNonce,
    createdAt: Date.now(),
  };

  await writeBet(bet);
  return NextResponse.json({ ok: true, balance: after, bet });
}
