import { NextRequest, NextResponse } from "next/server";
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
import { notifyNewBet } from "@/lib/notify";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  initData?: string;
  amount?: number;
  chance?: number;
  dir?: "more" | "less";
  notify?: boolean;
};

function publicCommit(serverSeed: string) {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
}

function roll(serverSeed: string, clientSeed: string, nonce: number) {
  const data = `${serverSeed}:${clientSeed}:${nonce}`;
  const h = crypto.createHash("sha256").update(data).digest("hex");
  const v = parseInt(h.slice(0, 8), 16);
  const value = (v % 999999) + 1; // 1-999999
  return { value, hex: h };
}

export async function POST(req: NextRequest) {
  try {
    const body: Body = await req.json();

    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
    }
    
    let initData = body.initData;
    if (!initData) {
      initData = req.headers.get('X-Telegram-Init-Data') || '';
    }

    if (!initData) {
      return NextResponse.json({ ok: false, error: "no initData" }, { status: 400 });
    }

    const v = verifyInitData(initData, botToken);
    if (!v.ok || !v.user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    
    const userId = Number(v.user.id);

    const amount = Math.floor(Number(body.amount || 0));
    const chance = Math.max(MIN_CHANCE, Math.min(MAX_CHANCE, Math.floor(Number(body.chance || 0))));
    const dir = body.dir || 'more';
    const notify = body.notify !== false;
    
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

    // ПРАВИЛЬНАЯ ЛОГИКА СТАВОК:
    const serverSeed = process.env.SERVER_SEED || "server_seed";
    const nonce = await incNonce(userId);
    const clientSeed = `${userId}:${nonce}`;
    const r = roll(serverSeed, clientSeed, nonce);

    const rolled = r.value; // 1-999999
    const totalNumbers = 999999;
    const winNumbersCount = Math.floor((chance / 100) * totalNumbers);
    
    let win = false;
    
    if (dir === 'more') {
      // При "больше": выигрышные числа в конце диапазона
      const minWinNumber = totalNumbers - winNumbersCount + 1;
      win = rolled >= minWinNumber;
    } else {
      // При "меньше": выигрышные числа в начале диапазона  
      win = rolled <= winNumbersCount;
    }

    // Расчет выплаты с комиссией 5%
    const baseMultiplier = 95 / chance; // Комиссия 5%
    const payout = win ? Math.floor(amount * baseMultiplier) : 0;

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
      chance: chance,
      dir,
      win,
      createdAt: Date.now(),
    };
    
    await pushBet(userId, bet);

    if (notify) {
      try {
        await notifyNewBet({
          userId,
          amount,
          chance: chance,
          result: win ? 'win' : 'lose',
          payout: won
        });
      } catch (notifyError) {
        console.error('Notification error:', notifyError);
      }
    }

    return NextResponse.json({
      ok: true,
      result: win ? "win" : "lose",
      chance: chance,
      rolled: rolled,
      payout: won,
      balanceDelta: win ? won - amount : -amount,
    });
    
  } catch (e: any) {
    console.error('Bet error:', e);
    return NextResponse.json({ ok: false, error: e?.message || "bet failed" }, { status: 500 });
  }
}