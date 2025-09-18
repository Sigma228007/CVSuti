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

export async function getNonce(uid: number): Promise<number> {
  const c = await redis();
  const n = await c.incr(nonceKey(uid));
  return Number(n);
}

/* ===================== DEPOSITS ===================== */

export type DepositMethod = "card" | "fkwallet";
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

// ключи
const depKey = (id: string) => `dep:${id}`;                      // JSON депозита
const depPendingZ = `deps:pending`;                              // ZSET id по времени
const processedOnceKey = (orderId: string) => `cb:once:${orderId}`; // защита от дублей

// небольшие JSON-хелперы
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

/** Создать заявку на депозит (pending) */
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

/** Получить депозит по id */
export async function getDeposit(id: string): Promise<Deposit | null> {
  return getJSON<Deposit>(depKey(id));
}

/** Апрув: зачислить и закрыть */
export async function approveDeposit(id: string): Promise<Deposit | null> {
  const c = await redis();
  const dep = await getJSON<Deposit>(depKey(id));
  if (!dep) return null;
  if (dep.status !== "pending") return dep;

  // зачисляем
  await addBalance(dep.userId, dep.amount);

  dep.status = "approved";
  dep.approvedAt = Date.now();

  await setJSON(depKey(id), dep);
  await c.zRem(depPendingZ, id);
  return dep;
}

/** Деклайн: пометить и закрыть */
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

/** Список ожидающих (последние N) */
export async function listPending(limit = 50): Promise<Deposit[]> {
  const c = await redis();
  // берём последние по времени
  const ids = await c.zRange(depPendingZ, -limit, -1);
  if (!ids.length) return [];
  const res: Deposit[] = [];
  for (const id of ids) {
    const d = await getJSON<Deposit>(depKey(id));
    if (d) res.push(d);
  }
  // отсортируем по времени убыв.
  res.sort((a, b) => b.createdAt - a.createdAt);
  return res;
}

/** Пометить «обработано единожды» для защиты от дублей callback'ов.
 *  Возвращает true, если пометка установлена впервые; false — если уже была. */
export async function markProcessedOnce(orderId: string, ttlSeconds = 24 * 60 * 60): Promise<boolean> {
  if (!orderId) return false;
  const c = await redis();
  // SETNX + EX
  const ok = await c.set(processedOnceKey(orderId), "1", { NX: true, EX: ttlSeconds });
  return ok === "OK";
}