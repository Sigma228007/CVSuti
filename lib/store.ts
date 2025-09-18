import { redis } from "./redis";

// ── ключи в Redis ────────────────────────────────────────────────
const balKey  = (uid: number) => `u:${uid}:balance`;
const dataKey = (uid: number) => `u:${uid}:data`;
const nonceKey = "global:nonce";

// ── баланс ───────────────────────────────────────────────────────
export async function getBalance(uid: number): Promise<number> {
  const r = await (await redis()).get(balKey(uid));
  return r ? parseInt(r, 10) : 0;
}

export async function setBalance(uid: number, value: number): Promise<number> {
  await (await redis()).set(
    balKey(uid),
    String(Math.max(0, Math.floor(value)))
  );
  return getBalance(uid);
}

export async function addBalance(uid: number, delta: number): Promise<number> {
  const c = await redis();
  const v = await c.incrBy(balKey(uid), Math.floor(delta));
  if (v < 0) {
    await c.set(balKey(uid), "0");
    return 0;
  }
  return v;
}

// ── произвольные данные пользователя (если нужно) ───────────────
export async function upsertUser(uid: number, data: Record<string, any>) {
  const c = await redis();
  await c.hSet(
    dataKey(uid),
    Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)])
    )
  );
}

// ── nonce для честности/нумерации раундов ───────────────────────
// Храним в Redis (глобальный счётчик). Возвращает следующий номер.
export async function getNonce(): Promise<number> {
  const c = await redis();
  const n = await c.incr(nonceKey);
  return Number(n);
}

// ── лента последних ставок ───────────────────────────────────────
// В некоторых местах вашего кода (app/api/bet/route.ts) импортируется
// `bets` как массив. Чтобы не ломать существующую логику, оставим
// лёгкое in-memory-хранилище. Если захотите — легко переведём на Redis.
export type BetRecord = {
  id: string;
  userId: number;
  amount: number;
  dir: "under" | "over";
  chance: number;
  nonce: number;
  outcome: any;
  placedAt: number
};

// Временный массив в памяти на 100 последних записей.
// (если в вашем маршруте делаешь `bets.unshift(bet)` — будет работать)
export const bets: BetRecord[] = [];

// Необязательная утилита — удобно вызывать из /api/bet:
export function pushBet(b: BetRecord) {
  bets.unshift(b);
  if (bets.length > 100) bets.pop();
}