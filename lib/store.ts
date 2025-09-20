import Redis from "ioredis";

// ---------- Singleton подключение к обычному Redis (Redis Cloud и т.п.) ----------
let _redis: Redis | null = null;

export function redis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set in .env");
    _redis = new Redis(url); // ioredis понимает redis://default:pass@host:port
  }
  return _redis;
}

// ---------- JSON-хелперы ----------
export async function setJSON<T>(key: string, value: T): Promise<void> {
  const c = redis();
  await c.set(key, JSON.stringify(value));
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const c = redis();
  const s = await c.get(key);
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// ---------- Ключи ----------
const balKey     = (uid: number) => `bal:${uid}`;
const nonceKey   = (uid: number) => `nonce:${uid}`;

const betsKey    = (uid: number) => `bets:${uid}`;
const depHistKey = (uid: number) => `hist:dep:${uid}`;
const wdHistKey  = (uid: number) => `hist:wd:${uid}`;

const depKey     = (id: string) => `dep:${id}`;
const wdKey      = (id: string) => `wd:${id}`;

const depsPendingZ = "deps:pending";
const wdsPendingZ  = "wds:pending";

// ---------- Баланс / nonce ----------
export async function getBalance(userId: number): Promise<number> {
  const c = redis();
  const v = await c.get(balKey(userId));
  return Number(v || 0);
}

export async function setBalance(userId: number, value: number): Promise<void> {
  const c = redis();
  await c.set(balKey(userId), String(value));
}

export async function incrBalance(userId: number, delta: number): Promise<number> {
  const c = redis();
  // если нужны копейки — можно заменить на incrbyfloat
  return await c.incrby(balKey(userId), Math.round(delta));
}

export async function getNonce(userId: number): Promise<number> {
  const c = redis();
  const v = await c.get(nonceKey(userId));
  return Number(v || 0);
}

export async function incNonce(userId: number, step = 1): Promise<number> {
  const c = redis();
  return await c.incrby(nonceKey(userId), step);
}

// ---------- Ставки ----------
export type BetRecord = {
  id: string;
  userId: number;
  amount: number;
  chance: number;
  result: "win" | "lose";
  payout: number;
  roll: number;
  commit: string;
  nonce: number;
  createdAt: number;
};

export async function writeBet(bet: BetRecord): Promise<void> {
  const c = redis();
  await c.lpush(betsKey(bet.userId), JSON.stringify(bet));
  await c.ltrim(betsKey(bet.userId), 0, 999); // храним до 1000 последних
}

// ---------- История пользователя ----------
export async function pushDepositHistory(
  userId: number,
  item: { id: string; amount: number; status: string; ts: number; source?: string }
): Promise<void> {
  const c = redis();
  await c.lpush(depHistKey(userId), JSON.stringify(item));
  await c.ltrim(depHistKey(userId), 0, 199); // до 200 последних депозитов
}

export async function pushWithdrawHistory(
  userId: number,
  item: { id: string; amount: number; status: string; ts: number; details?: any }
): Promise<void> {
  const c = redis();
  await c.lpush(wdHistKey(userId), JSON.stringify(item));
  await c.ltrim(wdHistKey(userId), 0, 199);
}

export async function getUserHistory(userId: number, limit = 50) {
  const c = redis();

  const depRaw = await c.lrange(depHistKey(userId), 0, limit - 1);
  const wdRaw  = await c.lrange(wdHistKey(userId),  0, limit - 1);
  const betRaw = await c.lrange(betsKey(userId),    0, limit - 1);

  const parseMany = (arr: (string | Buffer)[]) =>
    (arr || []).map((s) => {
      try { return JSON.parse(s.toString()); } catch { return null; }
    }).filter(Boolean);

  return {
    deposits: parseMany(depRaw),
    withdrawals: parseMany(wdRaw),
    bets: parseMany(betRaw) as BetRecord[],
  };
}

// ---------- Pending-списки ----------
export async function listPendingDeposits(limit = 100) {
  const c = redis();
  const ids = await c.zrange(depsPendingZ, 0, limit - 1);
  const items = await Promise.all(
    (ids as string[]).map((id) => c.get(depKey(id)))
  );
  return items
    .map((s) => (s ? JSON.parse(s) : null))
    .filter(Boolean);
}

export async function listPendingWithdrawals(limit = 100) {
  const c = redis();
  const ids = await c.zrange(wdsPendingZ, 0, limit - 1);
  const items = await Promise.all(
    (ids as string[]).map((id) => c.get(wdKey(id)))
  );
  return items
    .map((s) => (s ? JSON.parse(s) : null))
    .filter(Boolean);
}

// ---------- Депозиты: получить и апрувнуть ----------
export type Deposit = {
  id: string;
  userId: number;
  amount: number;
  status: "pending" | "approved" | "declined";
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
  source?: string; // FKWallet / FreeKassa / …
};

export async function getDeposit(id: string): Promise<Deposit | null> {
  return await getJSON<Deposit>(depKey(id));
}

/**
 * Подтверждает депозит:
 *  - ставит статус approved + время,
 *  - удаляет из ZSET pending,
 *  - плюсуeт баланс,
 *  - пишет в историю депозитов пользователя,
 *  - сохраняет обновлённый JSON депозита.
 */
export async function approveDeposit(dep: Deposit): Promise<void> {
  const c = redis();
  const now = Date.now();

  dep.status = "approved";
  dep.approvedAt = now;

  await c.zrem(depsPendingZ, dep.id);
  await incrBalance(dep.userId, dep.amount);
  await pushDepositHistory(dep.userId, {
    id: dep.id,
    amount: dep.amount,
    status: dep.status,
    ts: dep.approvedAt!,
    source: dep.source || "FKWallet",
  });
  await setJSON(depKey(dep.id), dep);
}