import { redis } from "./redis";

/* ===================== BALANCE ===================== */

const balKey = (uid: number) => `u:${uid}:balance`;
const dataKey = (uid: number) => `u:${uid}:data`;

export async function getBalance(uid: number): Promise<number> {
  const r = await (await redis()).get(balKey(uid));
  return r ? parseInt(r, 10) : 0;
}

export async function setBalance(uid: number, value: number): Promise<number> {
  await (await redis()).set(balKey(uid), String(Math.max(0, Math.floor(value))));
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

/* ===================== USERS ===================== */

export async function upsertUser(uid: number, data: Record<string, any>) {
  const c = await redis();
  await c.hSet(
    dataKey(uid),
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)])),
  );
}

/* ===================== NONCE (для ставок) ===================== */

const nonceKey = (uid: number) => `u:${uid}:nonce`;

export async function getNonce(uid?: number): Promise<number> {
  const c = await redis();
  const key = uid ? `u:${uid}:nonce` : 'nonce';
  const n = await c.incr(key);
  return Number(n);
}

/* ===================== DEPOSITS ===================== */

// ОСТАВЛЯЕМ ТОЛЬКО КАССУ
export type DepositMethod = "fkwallet";
export type DepositStatus = "pending" | "approved" | "declined";

export type Deposit = {
  id: string;
  userId: number;
  amount: number;
  method: DepositMethod;
  status: DepositStatus;
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
  meta?: any;
};

const depKey = (id: string) => `dep:${id}`;
const depPendingZ = `deps:pending`;
const processedOnceKey = (orderId: string) => `cb:once:${orderId}`;

async function setJSON<T>(key: string, value: T): Promise<void> {
  const c = await redis();
  await c.set(key, JSON.stringify(value));
}

async function getJSON<T>(key: string): Promise<T | null> {
  const c = await redis();
  const s = await c.get(key);
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/** Создать заявку на депозит (pending) — если где-то ещё используешь ручные заявки */
export async function createDepositRequest(
  userId: number,
  amount: number,
  method: DepositMethod,
  meta?: any
): Promise<Deposit> {
  const id = `dep_${Date.now()}_${userId}_${Math.floor(Math.random() * 1e6)}`;
  const dep: Deposit = {
    id,
    userId,
    amount: Math.floor(amount),
    method,
    status: "pending",
    createdAt: Date.now(),
    meta: meta ?? null,
  };

  const c = await redis();
  await setJSON(depKey(id), dep);
  await c.zAdd(depPendingZ, [{ score: dep.createdAt, value: id }]);

  return dep;
}

export async function getDeposit(id: string): Promise<Deposit | null> {
  return getJSON<Deposit>(depKey(id));
}

export async function approveDeposit(id: string): Promise<Deposit | null> {
  const c = await redis();
  const dep = await getJSON<Deposit>(depKey(id));
  if (!dep) return null;
  if (dep.status !== "pending") return dep;

  await addBalance(dep.userId, dep.amount);
  dep.status = "approved";
  dep.approvedAt = Date.now();

  await setJSON(depKey(id), dep);
  await c.zRem(depPendingZ, id);
  return dep;
}

export async function declineDeposit(id: string): Promise<Deposit | null> {
  const c = await redis();
  const dep = await getJSON<Deposit>(depKey(id));
  if (!dep) return null;
  if (dep.status !== "pending") return dep;

  dep.status = "declined";
  dep.declinedAt = Date.now();

  await setJSON(depKey(id), dep);
  await c.zRem(depPendingZ, id);
  return dep;
}

export async function listPending(limit = 50): Promise<Deposit[]> {
  const c = await redis();
  const ids = await c.zRange(depPendingZ, -limit, -1);
  if (!ids.length) return [];
  const res: Deposit[] = [];
  for (const id of ids) {
    const d = await getJSON<Deposit>(depKey(id));
    if (d) res.push(d);
  }
  res.sort((a, b) => b.createdAt - a.createdAt);
  return res;
}

export async function markProcessedOnce(orderId: string, ttlSeconds = 24 * 60 * 60): Promise<boolean> {
  if (!orderId) return false;
  const c = await redis();
  const ok = await c.set(processedOnceKey(orderId), "1", { NX: true, EX: ttlSeconds });
  return ok === "OK";
}

/* ===== Ставки в памяти ===== */

export type BetRecord = {
  id: string;
  userId: number;
  amount: number;
  chance: number;
  dir: "under" | "over";
  nonce: number;
  placedAt: number;
  outcome: {
    value: number;
    win: boolean;
    payout: number;
    coef: number;
    proof: {
      serverSeedHash: string;
      serverSeed: string;
      clientSeed: string;
      hex: string;
    };
  };
};

export const bets: BetRecord[] = [];

export function pushBet(bet: BetRecord) {
  bets.unshift(bet);
  if (bets.length > 100) bets.pop();
}

// ВЫВОД СРЕДСТВ (manual by admin)
// ----------------------------------------------------------------

export type WithdrawStatus = "pending" | "approved" | "declined";
export type Withdraw = {
  id: string;
  userId: number;
  amount: number;          // списываем сразу в резерв при создании
  details?: any;           // реквизиты вручную (карта/кошелёк и т.п.)
  status: WithdrawStatus;
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
};

// ключи
const wdKey = (id: string) => `wd:${id}`;          // JSON заявки на вывод
const wdPendingZ = `wds:pending`;                  // ZSET id по времени

/** Создать заявку на вывод: проверяем баланс, СРАЗУ списываем средства и кладём в pending. */
export async function createWithdrawRequest(
  userId: number,
  amount: number,
  details?: any
): Promise<Withdraw> {
  const c = await redis();
  amount = Math.floor(amount);
  if (amount <= 0) throw new Error("bad amount");

  // проверим баланс и спишем (резерв)
  const current = await getBalance(userId);
  if (current < amount) throw new Error("insufficient");
  await c.decrBy(`u:${userId}:balance`, amount);

  const id = `wd_${Date.now()}_${userId}_${Math.floor(Math.random() * 1e6)}`;
  const wd: Withdraw = {
    id,
    userId,
    amount,
    details: details ?? null,
    status: "pending",
    createdAt: Date.now(),
  };

  // используем уже существующие setJSON/getJSON из файла
  await setJSON(wdKey(id), wd as any);
  await c.zAdd(wdPendingZ, [{ score: wd.createdAt, value: id }]);

  return wd;
}

/** Получить вывод по id */
export async function getWithdraw(id: string): Promise<Withdraw | null> {
  return (await getJSON<Withdraw>(wdKey(id)));
}

/** Список ожидающих выводов (последние N) */
export async function listPendingWithdrawals(limit = 50): Promise<Withdraw[]> {
  const c = await redis();
  const ids = await c.zRange(wdPendingZ, -limit, -1);
  if (!ids.length) return [];
  const res: Withdraw[] = [];
  for (const id of ids) {
    const w = await getJSON<Withdraw>(wdKey(id));
    if (w) res.push(w);
  }
  res.sort((a, b) => b.createdAt - a.createdAt);
  return res;
}

/** Апрув вывода: просто помечаем, т.к. деньги уже списаны при создании */
export async function approveWithdraw(id: string): Promise<Withdraw | null> {
  const c = await redis();
  const wd = await getJSON<Withdraw>(wdKey(id));
  if (!wd) return null;
  if (wd.status !== "pending") return wd;

  wd.status = "approved";
  wd.approvedAt = Date.now();

  await setJSON(wdKey(id), wd as any);
  await c.zRem(wdPendingZ, id);
  return wd;
}

/** Деклайн вывода: ВОЗВРАЩАЕМ деньги на баланс и закрываем */
export async function declineWithdraw(id: string): Promise<Withdraw | null> {
  const c = await redis();
  const wd = await getJSON<Withdraw>(wdKey(id));
  if (!wd) return null;
  if (wd.status !== "pending") return wd;

  // Возврат средств
  await c.incrBy(`u:${wd.userId}:balance`, wd.amount);

  wd.status = "declined";
  wd.declinedAt = Date.now();

  await setJSON(wdKey(id), wd as any);
  await c.zRem(wdPendingZ, id);
  return wd;
}

/** История пользователя: последние депозиты и выводы */
export async function getUserHistory(
  userId: number,
  limit = 50
): Promise<{ deposits: Deposit[]; withdrawals: Withdraw[] }> {
  const c = await redis();

  const wds: Withdraw[] = [];
  const deps: Deposit[] = [];

  // SCAN wd:*
  let cursor = 0;
  do {
    const { cursor: next, keys } = await c.scan(cursor, { MATCH: "wd:*", COUNT: 500 } as any);
    cursor = Number(next);
    for (const k of keys) {
      const w = await getJSON<Withdraw>(k);
      if (w && w.userId === userId) wds.push(w);
    }
  } while (cursor !== 0);

  // SCAN dep:*
  cursor = 0;
  do {
    const { cursor: next, keys } = await c.scan(cursor, { MATCH: "dep:*", COUNT: 500 } as any);
    cursor = Number(next);
    for (const k of keys) {
      const d = await getJSON<Deposit>(k);
      if (d && d.userId === userId) deps.push(d);
    }
  } while (cursor !== 0);

  wds.sort((a, b) => b.createdAt - a.createdAt);
  deps.sort((a, b) => b.createdAt - a.createdAt);

  return {
    withdrawals: wds.slice(0, limit),
    deposits: deps.slice(0, limit),
  };
}