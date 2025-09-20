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

/* ===================== NONCE ===================== */

export async function getNonce(uid?: number): Promise<number> {
  const c = await redis();
  const key = uid ? `u:${uid}:nonce` : "nonce";
  const n = await c.incr(key);
  return Number(n);
}

/* ===================== DEPOSITS ===================== */

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

  // сохраним в историю
  await c.lPush(`hist:dep:${dep.userId}`, JSON.stringify({
    id: dep.id,
    amount: dep.amount,
    status: dep.status,
    ts: dep.approvedAt,
    source: "FKWallet",
  }));

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

export async function listPendingDeposits(limit = 50): Promise<Deposit[]> {
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

/* ===================== WITHDRAWS ===================== */

export type WithdrawStatus = "pending" | "approved" | "declined";

export type Withdraw = {
  id: string;
  userId: number;
  amount: number;
  details?: any;
  status: WithdrawStatus;
  createdAt: number;
  approvedAt?: number;
  declinedAt?: number;
};

const wdKey = (id: string) => `wd:${id}`;
const wdPendingZ = `wds:pending`;

export async function createWithdrawRequest(
  userId: number,
  amount: number,
  details?: any
): Promise<Withdraw> {
  const balance = await getBalance(userId);
  if (amount > balance) {
    throw new Error("Insufficient balance");
  }

  await setBalance(userId, balance - amount);

  const id = `wd_${Date.now()}_${userId}_${Math.floor(Math.random() * 1e6)}`;
  const wd: Withdraw = {
    id,
    userId,
    amount: Math.floor(amount),
    details,
    status: "pending",
    createdAt: Date.now(),
  };

  const c = await redis();
  await setJSON(wdKey(id), wd);
  await c.zAdd(wdPendingZ, [{ score: wd.createdAt, value: id }]);

  return wd;
}

export async function getWithdraw(id: string): Promise<Withdraw | null> {
  return getJSON<Withdraw>(wdKey(id));
}

export async function approveWithdraw(id: string): Promise<Withdraw | null> {
  const c = await redis();
  const wd = await getJSON<Withdraw>(wdKey(id));
  if (!wd) return null;
  if (wd.status !== "pending") return wd;

  wd.status = "approved";
  wd.approvedAt = Date.now();

  await setJSON(wdKey(id), wd);
  await c.zRem(wdPendingZ, id);

  await c.lPush(`hist:wd:${wd.userId}`, JSON.stringify({
    id: wd.id,
    amount: wd.amount,
    status: wd.status,
    ts: wd.approvedAt,
    details: wd.details,
  }));

  return wd;
}

export async function declineWithdraw(id: string): Promise<Withdraw | null> {
  const c = await redis();
  const wd = await getJSON<Withdraw>(wdKey(id));
  if (!wd) return null;
  if (wd.status !== "pending") return wd;

  wd.status = "declined";
  wd.declinedAt = Date.now();

  await setJSON(wdKey(id), wd);
  await c.zRem(wdPendingZ, id);

  await addBalance(wd.userId, wd.amount);

  return wd;
}

export async function listPendingWithdraws(limit = 50): Promise<Withdraw[]> {
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

/* ===================== HISTORY ===================== */

export async function getDepositHistory(uid: number, limit = 10) {
  const c = await redis();
  const items = await c.lRange(`hist:dep:${uid}`, 0, limit - 1);
  return items.map((s) => JSON.parse(s));
}

export async function getWithdrawHistory(uid: number, limit = 10) {
  const c = await redis();
  const items = await c.lRange(`hist:wd:${uid}`, 0, limit - 1);
  return items.map((s) => JSON.parse(s));
}